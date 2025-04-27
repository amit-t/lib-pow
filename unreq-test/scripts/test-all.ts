// scripts/test-all.ts
import { spawn, ChildProcess } from "child_process";
import { makeAndCancelRequest } from "../src/utils/client.js";
import logger from "../src/utils/logger.js";

// Server configuration
const servers = [
  {
    name: "Express + PostgreSQL",
    script: "src/express/postgres.ts",
    port: 3001,
    command: "pnpm",
    args: ["express:pg"],
  },
  {
    name: "Express + MySQL",
    script: "src/express/mysql.ts",
    port: 3002,
    command: "pnpm",
    args: ["express:mysql"],
  },
  {
    name: "Express + MongoDB",
    script: "src/express/mongodb.ts",
    port: 3003,
    command: "pnpm",
    args: ["express:mongo"],
  },
  {
    name: "Fastify + PostgreSQL",
    script: "src/fastify/postgres.ts",
    port: 3004,
    command: "pnpm",
    args: ["fastify:pg"],
  },
  {
    name: "Fastify + MySQL",
    script: "src/fastify/mysql.ts",
    port: 3005,
    command: "pnpm",
    args: ["fastify:mysql"],
  },
  {
    name: "Fastify + MongoDB",
    script: "src/fastify/mongodb.ts",
    port: 3006,
    command: "pnpm",
    args: ["fastify:mongo"],
  },
  {
    name: "Elysia + PostgreSQL",
    script: "src/elysia/postgres.ts",
    port: 3007,
    command: "pnpm",
    args: ["elysia:pg"],
  },
  {
    name: "Elysia + MySQL",
    script: "src/elysia/mysql.ts",
    port: 3008,
    command: "pnpm",
    args: ["elysia:mysql"],
  },
  {
    name: "Elysia + MongoDB",
    script: "src/elysia/mongodb.ts",
    port: 3009,
    command: "pnpm",
    args: ["elysia:mongo"],
  },
];

// Run a server process
function runServer(server: typeof servers[0]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    logger.info(`Starting ${server.name}...`);
    
    const process = spawn(server.command, server.args, {
      stdio: "pipe",
      shell: true,
    });
    
    let output = "";
    let errorOutput = "";
    
    process.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line: string) => {
        if (line.trim()) {
          logger.info(`[${server.name}] ${line.trim()}`);
        }
      });
      output += data.toString();
      
      // Resolve when server is started
      if (output.includes(`running at http://localhost:${server.port}`)) {
        logger.info(`${server.name} started successfully!`);
        resolve(process);
      }
    });
    
    process.stderr.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line: string) => {
        if (line.trim()) {
          logger.error(`[${server.name}] ${line.trim()}`);
        }
      });
      errorOutput += data.toString();
    });
    
    process.on("error", (error) => {
      logger.error(`Error starting ${server.name}:`, error);
      reject(error);
    });
    
    process.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        logger.error(`${server.name} exited with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    // Timeout if server doesn't start within 30 seconds
    const timeout = setTimeout(() => {
      logger.error(`Timeout starting ${server.name}`);
      process.kill();
      reject(new Error("Server start timeout"));
    }, 30000);
    
    process.on("exit", () => clearTimeout(timeout));
  });
}

// Test a specific server implementation
async function testServer(server: typeof servers[0]): Promise<boolean> {
  logger.info(`\n=== Testing ${server.name} ===\n`);
  
  // Start server process
  let serverProcess: ChildProcess | null = null;
  
  try {
    serverProcess = await runServer(server);
    
    // Allow some time for the server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that the server is healthy
    const healthUrl = `http://localhost:${server.port}/health`;
    await makeAndCancelRequest(healthUrl, 500);
    
    // Wait a moment before the long query test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Make a request that will be cancelled
    // The query will run for 10 seconds, but we cancel after 2 seconds
    const longQueryUrl = `http://localhost:${server.port}/api/long-query?duration=10`;
    await makeAndCancelRequest(longQueryUrl, 2000);
    
    // Allow some time for logs to be captured after cancellation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logger.info(`\n✅ ${server.name} test completed successfully!\n`);
    return true;
  } catch (error) {
    logger.error(`\n❌ ${server.name} test failed:`, error);
    return false;
  } finally {
    // Cleanup: Kill the server process
    if (serverProcess) {
      serverProcess.kill();
      logger.info(`Stopped ${server.name} server`);
    }
  }
}

// Main function to run tests sequentially
async function runTests() {
  logger.info("Starting unreq integration tests for all server and database combinations");
  
  let passed = 0;
  let failed = 0;
  
  // Run each test sequentially
  for (const server of servers) {
    try {
      const success = await testServer(server);
      if (success) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error(`Error running ${server.name} test:`, error);
      failed++;
    }
    
    // Add a short delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Print summary
  logger.info("\n=== Test Results Summary ===");
  logger.info(`✅ ${passed} tests passed`);
  logger.info(`❌ ${failed} tests failed`);
  logger.info(`Total: ${servers.length} tests\n`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
