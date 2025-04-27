// src/elysia/mysql.ts
import { Elysia } from "elysia";
import { 
  createElysiaCancellationPlugin, 
  withElysiaDbCancellation, 
  createMySqlCancellationHook,
  getMySqlThreadId
} from "unreq";
import { getMysqlPool, createLongMysqlQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const PORT = 3008;

// Initialize database connection
let mysqlPool: any;

async function startServer() {
  try {
    // Initialize MySQL connection
    mysqlPool = await getMysqlPool();

    // Set up the cancellation hook specific to MySQL
    const mysqlCancelHook = createMySqlCancellationHook(mysqlPool);
    
    // Create the Elysia cancellation plugin
    const cancellationPlugin = createElysiaCancellationPlugin({
      dbCancellationHook: mysqlCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Create the Elysia app
    const app = new Elysia()
      .use(cancellationPlugin)
      .get("/health", () => {
        return { status: "ok", type: "elysia + mysql" };
      })
      .get("/api/long-query", withElysiaDbCancellation(
        async (context) => {
          try {
            logger.info("Starting long-running MySQL query");
            const durationSeconds = parseInt(context.query.duration as string, 10) || 30;
            
            // Execute a query that will take some time
            const result = await createLongMysqlQuery(mysqlPool, durationSeconds);
            
            logger.info("Query completed successfully");
            return { 
              success: true, 
              message: "Long query completed", 
              rowCount: result[0].length 
            };
          } catch (error: any) {
            logger.error("Error during query execution:", error);
            
            // Check if this was a cancellation
            if (error.message && error.message.includes("KILL QUERY")) {
              logger.info("Query was successfully cancelled on the database side");
              context.set.status = 499;
              return { 
                success: false, 
                message: "Query was cancelled by the server due to client disconnection"
              };
            } else {
              context.set.status = 500;
              return { 
                success: false, 
                message: "Error executing query", 
                error: error.message 
              };
            }
          }
        },
        async (context) => {
          // Get the MySQL thread ID to identify the query
          const connection = await mysqlPool.getConnection();
          try {
            const threadId = getMySqlThreadId(connection);
            logger.info(`Associated MySQL thread ID: ${threadId} with request`);
            return { threadId };
          } finally {
            connection.release();
          }
        }
      ))
      .listen(PORT);
    
    logger.info(`Elysia (Bun) + MySQL test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
