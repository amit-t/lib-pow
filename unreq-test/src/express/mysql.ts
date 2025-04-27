// src/express/mysql.ts
import express from "express";
import { 
  createExpressCancellationMiddleware, 
  withExpressDbCancellation, 
  createMySqlCancellationHook,
  getMySqlThreadId
} from "unreq";
import { getMysqlPool, createLongMysqlQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const app = express();
const PORT = 3002;

// Initialize database connection
let mysqlPool: any;

async function startServer() {
  try {
    // Initialize MySQL connection
    mysqlPool = await getMysqlPool();

    // Set up the cancellation hook specific to MySQL
    const mysqlCancelHook = createMySqlCancellationHook(mysqlPool);
    
    // Create the middleware with in-memory registry
    const { middleware, registry } = createExpressCancellationMiddleware({
      dbCancellationHook: mysqlCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Apply middleware
    app.use(middleware);
    app.use(express.json());
    
    // Simple healthcheck endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", type: "express + mysql" });
    });
    
    // Long-running query with cancellation support
    app.get("/api/long-query", withExpressDbCancellation(
      async (req, res) => {
        try {
          logger.info("Starting long-running MySQL query");
          const durationSeconds = parseInt(req.query.duration as string, 10) || 30;
          
          // Execute a query that will take some time
          const result = await createLongMysqlQuery(mysqlPool, durationSeconds);
          
          logger.info("Query completed successfully");
          res.json({ 
            success: true, 
            message: "Long query completed", 
            rowCount: result[0].length 
          });
        } catch (error: any) {
          logger.error("Error during query execution:", error);
          
          // Check if this was a cancellation
          if (error.message && error.message.includes("KILL QUERY")) {
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
    app.listen(PORT, () => {
      logger.info(`Express + MySQL test server running at http://localhost:${PORT}`);
    });
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
