# Unreq Test Project

This project demonstrates the [`unreq`](https://www.npmjs.com/package/unreq) package in action, testing HTTP request cancellation propagation with different server frameworks and database adapters.

## Overview

This test project includes implementations of:

- **3 Server Frameworks**:
  - Express
  - Fastify
  - Elysia (Bun)

- **3 Databases**:
  - PostgreSQL
  - MySQL
  - MongoDB

- **Features Demonstrated**:
  - Automatic client request cancellation detection
  - Database query cancellation with backend-specific hooks
  - Clean request cleanup

## Prerequisites

You can run this project in two ways:

### Option 1: Using Docker (Recommended)

All you need is:
1. Docker
2. Docker Compose

### Option 2: Running Locally

If you prefer to run the tests locally, you'll need:
1. Node.js (16+) and pnpm
2. Bun runtime
3. PostgreSQL, MySQL, and MongoDB services

## Running with Docker (Recommended)

We provide a complete Docker setup with all required services (PostgreSQL, MySQL, MongoDB) and the test application.

```bash
# Clone this repository
git clone https://github.com/amit-t/unreq-test.git
cd unreq-test

# Build and run all tests in one command
./scripts/docker-setup.sh
```

Alternatively, you can use the npm scripts:

```bash
# Build Docker images
pnpm docker:build

# Run all tests in Docker
pnpm docker:test

# Bring down all containers when done
pnpm docker:down
```

For more details on the Docker setup, see [DOCKER.md](./DOCKER.md).

## Running Locally

### Installation

```bash
# Clone this repository
git clone https://github.com/amit-t/unreq-test.git
cd unreq-test

# Install dependencies
pnpm install
```

### Database Setup

Make sure you have PostgreSQL, MySQL, and MongoDB running locally, then set up the database schemas and test data:

```bash
# Setup PostgreSQL
pnpm run setup:pg

# Setup MySQL
pnpm run setup:mysql

# Setup MongoDB
pnpm run setup:mongo
```

### Running the Tests

You can run individual server/database combinations:

```bash
# Express + PostgreSQL
pnpm run express:pg

# Fastify + MySQL
pnpm run fastify:mysql

# Elysia + MongoDB
pnpm run elysia:mongo

# ... and so on for all 9 combinations
```

Or run all tests sequentially:

```bash
pnpm run test:all
```

## How to Test Cancellation Manually

1. Start one of the servers:
   ```bash
   pnpm run express:pg
   ```

2. In another terminal, make a request to the long-running query endpoint and cancel it:
   ```bash
   curl http://localhost:3001/api/long-query?duration=30 &
   # After a moment, press Ctrl+C to cancel
   ```

3. Observe the server logs - you should see that the query was successfully cancelled in the database.

## How It Works

1. The server uses `unreq` to detect when a client terminates a connection
2. When cancellation is detected, the appropriate DB cancellation hook is triggered
3. The hook executes database-specific commands (e.g., `pg_cancel_backend` for PostgreSQL)
4. Resources are cleaned up, and the cancelled query doesn't continue consuming resources

## License

MIT
