// scripts/setup-mongodb.ts
import { MongoClient } from "mongodb";
import logger from "../src/utils/logger.js";

async function setupMongodb() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const client = new MongoClient(uri);
  
  try {
    logger.info("Setting up MongoDB test database");
    
    await client.connect();
    const db = client.db("unreq_test");
    
    // Create collection if it doesn't exist
    const collections = await db.listCollections({ name: "test_data" }).toArray();
    if (collections.length === 0) {
      logger.info("Creating test_data collection");
      await db.createCollection("test_data");
    } else {
      logger.info("test_data collection already exists");
    }
    
    // Check if collection has data
    const count = await db.collection("test_data").countDocuments();
    
    if (count === 0) {
      logger.info("Inserting test data");
      const testData = [];
      
      for (let i = 0; i < 10000; i++) {
        testData.push({
          name: `test-${i}`,
          value: Math.floor(Math.random() * 1000),
          createdAt: new Date()
        });
        
        // Insert in batches of 1000
        if (testData.length === 1000 || i === 9999) {
          await db.collection("test_data").insertMany(testData);
          testData.length = 0;
        }
      }
    } else {
      logger.info(`Test data already exists (${count} documents)`);
    }
    
    // Ensure we have an index for better query performance
    logger.info("Creating index on 'name' field");
    await db.collection("test_data").createIndex({ name: 1 });
    
    // Create a JavaScript function to enable sleep in MongoDB aggregation
    await db.admin().command({
      setParameter: 1,
      javascriptEnabled: true
    }).catch(err => {
      logger.warn("Could not enable JavaScript in MongoDB, may already be enabled:", err.message);
    });
    
    logger.info("MongoDB setup completed successfully");
  } catch (error) {
    logger.error("Error setting up MongoDB:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupMongodb();
