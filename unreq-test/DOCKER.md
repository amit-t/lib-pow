# Docker Setup for Unreq Tests

This document explains how to use Docker to run all the unreq integration tests with all database services properly configured.

## Prerequisites

- Docker
- Docker Compose

## Configuration

The Docker setup consists of:

1. A Dockerfile for the application
2. A docker-compose.yml file that orchestrates:
   - The application
   - PostgreSQL database
   - MySQL database 
   - MongoDB database

## Environment Variables

The application is configured to use environment variables for all database connections:

### PostgreSQL
- `PG_HOST`: Hostname for PostgreSQL (default: "localhost")
- `PG_PORT`: Port for PostgreSQL (default: 5432)
- `PG_DB`: Database name (default: "unreq_test")
- `PG_USER`: Username (default: "postgres")
- `PG_PASSWORD`: Password (default: "postgres")

### MySQL
- `MYSQL_HOST`: Hostname for MySQL (default: "localhost")
- `MYSQL_PORT`: Port for MySQL (default: 3306)
- `MYSQL_DB`: Database name (default: "unreq_test")
- `MYSQL_USER`: Username (default: "root")
- `MYSQL_PASSWORD`: Password (default: "root")

### MongoDB
- `MONGO_URI`: MongoDB connection string (default: "mongodb://localhost:27017")

## Commands

The following npm scripts are available for Docker operations:

- `pnpm docker:build` - Build the Docker images
- `pnpm docker:up` - Start all services in detached mode
- `pnpm docker:down` - Stop and remove all services
- `pnpm docker:test` - Run all tests and exit when tests are complete

## Running Tests

To run tests in Docker:

```bash
# Build the Docker images
pnpm docker:build

# Run tests (this will set up databases, run tests, and exit)
pnpm docker:test
```

## Stopping Services

```bash
# Stop and remove all services
pnpm docker:down
```

## Continuous Integration

This Docker setup is suitable for CI environments. In a CI pipeline, you can simply run:

```bash
docker-compose up --abort-on-container-exit --exit-code-from app
```

This will run all tests and exit with the appropriate code for CI workflows.
