#!/bin/bash
set -e

echo "Starting deployment of Restaurant Management System..."

# Ensure .env exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Copying from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo ".env created. Please update it with your production secrets and re-run this script."
        exit 1
    else
        echo "Error: Neither .env nor .env.example found."
        exit 1
    fi
fi

echo "Pulling latest code..."
# Uncomment the following line if using git
# git pull origin main

echo "Building and starting Docker containers..."
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi
$DOCKER_COMPOSE -f docker-compose.prod.yml down || true
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d --build

echo "Waiting for database to be ready..."
sleep 15

echo "Running database migrations and seeds..."
# The server startup automatically runs migrations and seeds 
# as per server/src/index.js startServer() function.
# No manual command is strictly necessary, but we can restart the server to ensure they ran after db is healthy.
$DOCKER_COMPOSE -f docker-compose.prod.yml restart server

echo "Deployment completed successfully! Application is running on port 80 (or configured PORT)."
