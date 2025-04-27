// src/elysia/mongodb.ts
import { Elysia } from "elysia";
import { 
  createElysiaCancellationPlugin, 
  withElysiaDbCancellation, 
  createMongoDbCancellationHook,
  getMongoDbOperationId
} from "unreq";
import { getMongoClient, createLongMongoQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const PORT = 3009;

// Initialize database connection
let mongoClient: any;

async function startServer() {
  try {
    // Initialize MongoDB connection
    mongoClient = await getMongoClient();
    const db = mongoClient.db("unreq_test");

    // Set up the cancellation hook specific to MongoDB
    const mongodbCancelHook = createMongoDbCancellationHook(db);
    
    // Create the Elysia cancellation plugin
    const cancellationPlugin = createElysiaCancellationPlugin({
      dbCancellationHook: mongodbCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Create the Elysia app
    const app = new Elysia()
      .use(cancellationPlugin)
      .get("/health", () => {
        return { status: "ok", type: "elysia + mongodb" };
      })
      .get("/api/long-query", withElysiaDbCancellation(
        async (context) => {
          try {
            logger.info("Starting long-running MongoDB query");
            const durationSeconds = parseInt(context.query.duration as string, 10) || 30;
            
            // Execute a query that will take some time
            const result = await createLongMongoQuery(mongoClient, durationSeconds);
            
            logger.info("Query completed successfully");
            return { 
              success: true, 
              message: "Long query completed", 
              resultCount: result.length 
            };
          } catch (error: any) {
            logger.error("Error during query execution:", error);
            
            // Check if this was a cancellation
            if (error.message && error.message.includes("operation was aborted")) {
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
          // This is a bit more complex with MongoDB - we need to find the operation ID
          // from the currentOp command after starting the operation
          const db = mongoClient.db("unreq_test");
          
          // We'll use a simpler approach for this demo by returning a placeholder
          // In a real app, you'd need to track the operation ID from the currentOp command
          // after the operation starts
          const opId = await getMongoDbOperationId(db, { ns: "unreq_test.test_data" });
          
          if (opId) {
            logger.info(`Associated MongoDB operation ID: ${opId} with request`);
            return { operationId: opId };
          } else {
            logger.warn("Could not find MongoDB operation ID");
            return { operationId: null };
          }
        }
      ))
      .listen(PORT);
    
    logger.info(`Elysia (Bun) + MongoDB test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
