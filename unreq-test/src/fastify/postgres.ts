// src/fastify/postgres.ts
import Fastify from "fastify";
import { 
  fastifyCancellation, 
  withFastifyDbCancellation, 
  createPostgresCancellationHook 
} from "unreq";
import { getPgPool, createLongPgQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const fastify = Fastify({
  logger: false // We'll use our own logger
});

const PORT = 3004;

// Initialize database connection
let pgPool: any;

async function startServer() {
  try {
    // Initialize PostgreSQL connection
    pgPool = await getPgPool();

    // Set up the cancellation hook specific to PostgreSQL
    const pgCancelHook = createPostgresCancellationHook(pgPool);
    
    // Register the fastify cancellation plugin
    fastify.register(fastifyCancellation, {
      dbCancellationHook: pgCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Simple healthcheck endpoint
    fastify.get("/health", async () => {
      return { status: "ok", type: "fastify + postgresql" };
    });
    
    // Long-running query with cancellation support
    fastify.get("/api/long-query", withFastifyDbCancellation(
      async (request, reply) => {
        try {
          logger.info("Starting long-running PostgreSQL query");
          const durationSeconds = parseInt(request.query.duration as string, 10) || 30;
          
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
    ));
    
    // Start server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`Fastify + PostgreSQL test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
