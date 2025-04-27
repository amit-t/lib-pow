// src/utils/db.ts
import { Pool } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import logger from "./logger.js";

// PostgreSQL connection
export const getPgPool = async (): Promise<Pool> => {
  const pool = new Pool({
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    database: process.env.PG_DB || "unreq_test",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "postgres",
  });
  
  try {
    // Test connection
    const client = await pool.connect();
    logger.info("PostgreSQL connection established");
    client.release();
    return pool;
  } catch (err) {
    logger.error("Failed to connect to PostgreSQL", err);
    throw err;
  }
};

// MySQL connection
export const getMysqlPool = async (): Promise<mysql.Pool> => {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    database: process.env.MYSQL_DB || "unreq_test",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    waitForConnections: true,
    connectionLimit: 10,
  });
  
  try {
    // Test connection
    const connection = await pool.getConnection();
    logger.info("MySQL connection established");
    connection.release();
    return pool;
  } catch (err) {
    logger.error("Failed to connect to MySQL", err);
    throw err;
  }
};

// MongoDB connection
export const getMongoClient = async (): Promise<MongoClient> => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    logger.info("MongoDB connection established");
    return client;
  } catch (err) {
    logger.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

// Helper function to create a long-running PostgreSQL query
export const createLongPgQuery = async (pool: Pool, durationSeconds = 30): Promise<any> => {
  const client = await pool.connect();
  try {
    // This query will take the specified number of seconds to complete
    return client.query(`SELECT pg_sleep(${durationSeconds}), generate_series(1, 1000000) AS num`);
  } finally {
    client.release();
  }
};

// Helper function to create a long-running MySQL query
export const createLongMysqlQuery = async (pool: mysql.Pool, durationSeconds = 30): Promise<any> => {
  const connection = await pool.getConnection();
  try {
    // This query will take the specified number of seconds to complete
    return connection.query(`SELECT SLEEP(${durationSeconds}), x FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) t1 CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) t2 CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) t3 CROSS JOIN (SELECT 1 UNION SELECT 2 UNION SELECT 3) t4 CROSS JOIN (SELECT 1 UNION SELECT 2) t5`);
  } finally {
    connection.release();
  }
};

// Helper function to create a long-running MongoDB query
export const createLongMongoQuery = async (client: MongoClient, durationSeconds = 30): Promise<any> => {
  const db = client.db("unreq_test");
  
  // First ensure we have a collection with data
  const collection = db.collection("test_data");
  
  // MongoDB doesn't have a sleep function, so we'll use a slow aggregation pipeline
  return collection.aggregate([
    { $match: {} },
    { $addFields: { sleep: { $function: {
      body: `function() { 
        const start = new Date().getTime();
        while(new Date().getTime() < start + ${durationSeconds * 1000}) {}
        return true;
      }`,
      args: [],
      lang: "js"
    }}}},
    { $limit: 1 }
  ]).toArray();
};
