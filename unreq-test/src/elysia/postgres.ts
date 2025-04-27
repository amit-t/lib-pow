// src/elysia/postgres.ts
import { Elysia } from "elysia";
import { 
  createElysiaCancellationPlugin, 
  withElysiaDbCancellation, 
  createPostgresCancellationHook 
} from "unreq";
import { getPgPool, createLongPgQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const PORT = 3007;

// Initialize database connection
let pgPool: any;

async function startServer() {
  try {
    // Initialize PostgreSQL connection
    pgPool = await getPgPool();

    // Set up the cancellation hook specific to PostgreSQL
    const pgCancelHook = createPostgresCancellationHook(pgPool);
    
    // Create the Elysia cancellation plugin
    const cancellationPlugin = createElysiaCancellationPlugin({
      dbCancellationHook: pgCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Create the Elysia app
    const app = new Elysia()
      .use(cancellationPlugin)
      .get("/health", () => {
        return { status: "ok", type: "elysia + postgresql" };
      })
      .get("/api/long-query", withElysiaDbCancellation(
        async (context) => {
          try {
            logger.info("Starting long-running PostgreSQL query");
            const durationSeconds = parseInt(context.query.duration as string, 10) || 30;
            
            // Execute a query that will take some time
            const result = await createLongPgQuery(pgPool, durationSeconds);
            
            logger.info("Query completed successfully");
            return { 
              success: true, 
              message: "Long query completed", 
              rowCount: result.rowCount 
            };
          } catch (error: any) {
            logger.error("Error during query execution:", error);
            
            // Check if this was a cancellation
            if (error.message && error.message.includes("canceling")) {
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
          // Get the PostgreSQL backend PID to identify the query
          const client = await pgPool.connect();
          try {
            logger.info("Getting PostgreSQL backend PID");
            const pidResult = await client.query('SELECT pg_backend_pid()');
            const pid = pidResult.rows[0].pg_backend_pid;
            logger.info(`Associated backend PID: ${pid} with request`);
            return { pid };
          } finally {
            client.release();
          }
        }
      ))
      .listen(PORT);
    
    logger.info(`Elysia (Bun) + PostgreSQL test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
