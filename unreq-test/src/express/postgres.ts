// src/express/postgres.ts
import express from "express";
import { 
  createExpressCancellationMiddleware, 
  withExpressDbCancellation, 
  createPostgresCancellationHook 
} from "unreq";
import { getPgPool, createLongPgQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const app = express();
const PORT = 3001;

// Initialize database connection
let pgPool: any;

async function startServer() {
  try {
    // Initialize PostgreSQL connection
    pgPool = await getPgPool();

    // Set up the cancellation hook specific to PostgreSQL
    const pgCancelHook = createPostgresCancellationHook(pgPool);
    
    // Create the middleware with in-memory registry
    const { middleware, registry } = createExpressCancellationMiddleware({
      dbCancellationHook: pgCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Apply middleware
    app.use(middleware);
    app.use(express.json());
    
    // Simple healthcheck endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", type: "express + postgresql" });
    });
    
    // Long-running query with cancellation support
    app.get("/api/long-query", withExpressDbCancellation(
      async (req, res) => {
        try {
          logger.info("Starting long-running PostgreSQL query");
          const durationSeconds = parseInt(req.query.duration as string, 10) || 30;
          
          // Execute a query that will take some time
          const result = await createLongPgQuery(pgPool, durationSeconds);
          
          logger.info("Query completed successfully");
          res.json({ 
            success: true, 
            message: "Long query completed", 
            rowCount: result.rowCount 
          });
        } catch (error: any) {
          logger.error("Error during query execution:", error);
          
          // Check if this was a cancellation
          if (error.message && error.message.includes("canceling")) {
            logger.info("Query was successfully cancelled on the database side");
            res.status(499).json({ 
              success: false, 
              message: "Query was cancelled by the server due to client disconnection"
            });
          } else {
            res.status(500).json({ 
              success: false, 
              message: "Error executing query", 
              error: error.message 
            });
          }
        }
      },
      registry,
      async (req) => {
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
    app.listen(PORT, () => {
      logger.info(`Express + PostgreSQL test server running at http://localhost:${PORT}`);
    });
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
