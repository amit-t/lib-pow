#!/bin/bash

# docker-setup.sh
# Helper script to set up and run tests in Docker environment

# Make sure script fails on any error
set -e

# Display help information
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: ./scripts/docker-setup.sh [command]"
  echo ""
  echo "Commands:"
  echo "  build     Build the Docker images"
  echo "  up        Start all containers in detached mode"
  echo "  down      Stop and remove all containers"
  echo "  test      Run all tests and exit when complete"
  echo "  logs      Show logs from all containers"
  echo "  clean     Remove all Docker resources (images, volumes, containers)"
  echo ""
  echo "If no command is provided, runs the full test suite."
  exit 0
fi

# Change to project root directory
cd "$(dirname "$0")/.."

# Process command
case "$1" in
  "build")
    echo "Building Docker images..."
    docker-compose build
    ;;
  "up")
    echo "Starting containers in detached mode..."
    docker-compose up -d
    ;;
  "down")
    echo "Stopping and removing containers..."
    docker-compose down
    ;;
  "test")
    echo "Running tests..."
    docker-compose up --abort-on-container-exit
    ;;
  "logs")
    echo "Showing logs..."
    docker-compose logs -f
    ;;
  "clean")
    echo "Cleaning up Docker resources..."
    docker-compose down -v --rmi all --remove-orphans
    ;;
  *)
    echo "Running full test suite..."
    
    # Build images
    echo "Building images..."
    docker-compose build
    
    # Run tests
    echo "Running tests..."
    docker-compose up --abort-on-container-exit
    
    # Clean up
    echo "Cleaning up..."
    docker-compose down
    ;;
esac

exit 0
