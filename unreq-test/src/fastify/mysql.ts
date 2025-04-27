// src/fastify/mysql.ts
import Fastify from "fastify";
import { 
  fastifyCancellation, 
  withFastifyDbCancellation, 
  createMySqlCancellationHook,
  getMySqlThreadId
} from "unreq";
import { getMysqlPool, createLongMysqlQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const fastify = Fastify({
  logger: false // We'll use our own logger
});

const PORT = 3005;

// Initialize database connection
let mysqlPool: any;

async function startServer() {
  try {
    // Initialize MySQL connection
    mysqlPool = await getMysqlPool();

    // Set up the cancellation hook specific to MySQL
    const mysqlCancelHook = createMySqlCancellationHook(mysqlPool);
    
    // Register the fastify cancellation plugin
    fastify.register(fastifyCancellation, {
      dbCancellationHook: mysqlCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Simple healthcheck endpoint
    fastify.get("/health", async () => {
      return { status: "ok", type: "fastify + mysql" };
    });
    
    // Long-running query with cancellation support
    fastify.get("/api/long-query", withFastifyDbCancellation(
      async (request, reply) => {
        try {
          logger.info("Starting long-running MySQL query");
          const durationSeconds = parseInt(request.query.duration as string, 10) || 30;
          
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
            return reply.code(499).send({ 
              success: false, 
              message: "Query was cancelled by the server due to client disconnection"
            });
          } else {
            return reply.code(500).send({ 
              success: false, 
              message: "Error executing query", 
              error: error.message 
            });
          }
        }
      },
      async (request) => {
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
    ));
    
    // Start server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`Fastify + MySQL test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
