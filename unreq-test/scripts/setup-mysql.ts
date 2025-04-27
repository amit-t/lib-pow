// scripts/setup-mysql.ts
import mysql from "mysql2/promise";
import logger from "../src/utils/logger.js";

async function setupMysql() {
  // Connect to MySQL with admin privileges
  const adminPool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    logger.info("Setting up MySQL test database");

    // Check if database exists and create if it doesn't
    const [dbResults] = await adminPool.query<mysql.RowDataPacket[]>(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'unreq_test'"
    );
    
    if (dbResults.length === 0) {
      // Create database if it doesn't exist
      logger.info("Creating unreq_test database");
      await adminPool.query("CREATE DATABASE unreq_test");
    } else {
      logger.info("unreq_test database already exists");
    }

    // Use the test database
    await adminPool.query("USE unreq_test");

    // Create test table if it doesn't exist
    logger.info("Creating test table");
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS test_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        value INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if table has data
    const [dataResults] = await adminPool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM test_data");
    
    if (!dataResults[0]?.count) {
      logger.info("Inserting test data");
      const insertPromises = [];
      // Use batch inserts for better performance
      const batchSize = 500;
      for (let i = 0; i < 10000; i += batchSize) {
        let values = [];
        let placeholders = [];
        
        for (let j = 0; j < batchSize && i + j < 10000; j++) {
          const idx = i + j;
          values.push(`test-${idx}`, Math.floor(Math.random() * 1000));
          placeholders.push("(?, ?)");
        }
        
        insertPromises.push(
          adminPool.query(
            `INSERT INTO test_data (name, value) VALUES ${placeholders.join(", ")}`,
            values
          )
        );
      }
      await Promise.all(insertPromises);
    } else {
      logger.info(`Test data already exists (${dataResults[0]?.count} rows)`);
    }

    // Close connection
    await adminPool.end();

    logger.info("MySQL setup completed successfully");
  } catch (error) {
    logger.error("Error setting up MySQL:", error);
    process.exit(1);
  }
}

setupMysql();
