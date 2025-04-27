// scripts/setup-postgres.ts
import { Pool } from "pg";
import logger from "../src/utils/logger.js";

async function setupPostgres() {
  // Connect to default database to create our test database
  const adminPool = new Pool({
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    database: "postgres",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "postgres",
  });

  try {
    logger.info("Setting up PostgreSQL test database");

    // Check if database exists
    const dbCheckResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'unreq_test'"
    );
    
    if (dbCheckResult.rowCount === 0) {
      // Create database if it doesn't exist
      logger.info("Creating unreq_test database");
      await adminPool.query("CREATE DATABASE unreq_test");
    } else {
      logger.info("unreq_test database already exists");
    }

    // Close admin connection
    await adminPool.end();

    // Connect to our test database
    const testPool = new Pool({
      host: process.env.PG_HOST || "localhost",
      port: parseInt(process.env.PG_PORT || "5432", 10),
      database: process.env.PG_DB || "unreq_test",
      user: process.env.PG_USER || "postgres",
      password: process.env.PG_PASSWORD || "postgres",
    });

    // Create test table if it doesn't exist
    logger.info("Creating test table");
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS test_data (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert test data if table is empty
    const dataCheckResult = await testPool.query("SELECT COUNT(*) FROM test_data");
    if (parseInt(dataCheckResult.rows[0].count, 10) === 0) {
      logger.info("Inserting test data");
      const insertPromises = [];
      for (let i = 0; i < 10000; i++) {
        insertPromises.push(
          testPool.query(
            "INSERT INTO test_data (name, value) VALUES ($1, $2)",
            [`test-${i}`, Math.floor(Math.random() * 1000)]
          )
        );
      }
      await Promise.all(insertPromises);
    } else {
      logger.info(`Test data already exists (${dataCheckResult.rows[0].count} rows)`);
    }

    // Close test connection
    await testPool.end();

    logger.info("PostgreSQL setup completed successfully");
  } catch (error) {
    logger.error("Error setting up PostgreSQL:", error);
    process.exit(1);
  }
}

setupPostgres();
