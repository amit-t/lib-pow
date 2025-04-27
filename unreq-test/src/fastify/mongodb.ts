// src/fastify/mongodb.ts
import Fastify from "fastify";
import { 
  fastifyCancellation, 
  withFastifyDbCancellation, 
  createMongoDbCancellationHook,
  getMongoDbOperationId
} from "unreq";
import { getMongoClient, createLongMongoQuery } from "../utils/db.js";
import logger from "../utils/logger.js";

const fastify = Fastify({
  logger: false // We'll use our own logger
});

const PORT = 3006;

// Initialize database connection
let mongoClient: any;

async function startServer() {
  try {
    // Initialize MongoDB connection
    mongoClient = await getMongoClient();
    const db = mongoClient.db("unreq_test");

    // Set up the cancellation hook specific to MongoDB
    const mongodbCancelHook = createMongoDbCancellationHook(db);
    
    // Register the fastify cancellation plugin
    fastify.register(fastifyCancellation, {
      dbCancellationHook: mongodbCancelHook,
      requestIdHeader: "x-request-id"
    });
    
    // Simple healthcheck endpoint
    fastify.get("/health", async () => {
      return { status: "ok", type: "fastify + mongodb" };
    });
    
    // Long-running query with cancellation support
    fastify.get("/api/long-query", withFastifyDbCancellation(
      async (request, reply) => {
        try {
          logger.info("Starting long-running MongoDB query");
          const durationSeconds = parseInt(request.query.duration as string, 10) || 30;
          
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
    ));
    
    // Start server
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`Fastify + MongoDB test server running at http://localhost:${PORT}`);
    
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
