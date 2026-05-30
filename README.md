# Advanced Restaurant Management System (RMS)

A modern, highly-responsive, and real-time Restaurant Management System built with React, Node.js, Express, and MySQL.

## Overview
This system is designed to handle the fast-paced environment of a modern restaurant. It eliminates physical tickets and miscommunication by connecting the Customer, Waiter, Kitchen, and Admin through real-time WebSockets. 

With features like Station-Wise Kitchen segregation, text-to-speech audio notifications for chefs, and seamless dynamic QR code menus, this application digitizes the entire dining experience.

## Documentation
Please refer to the following documents for deep dives into the system:
- [FEATURES.md](./FEATURES.md): Comprehensive list of all capabilities by portal.
- [ARCHITECTURE.md](./ARCHITECTURE.md): Technical breakdown of the stack, real-time flows, and database schema.

## Getting Started (Development)

### Prerequisites
- Node.js (v18 or higher recommended)
- MySQL Server (v8.0+)
- Docker (optional, but recommended for easy database setup)

### Setup

1. **Clone and Install**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` in the root directory and update your database credentials.
   ```bash
   cp .env.example .env
   ```

3. **Database Setup**
   If you have Docker installed, you can easily spin up the database:
   ```bash
   docker-compose up -d db
   ```
   *Note: The server will automatically run Knex migrations and seeds upon startup.*

4. **Run the Application**
   ```bash
   # Start the Node.js API server (runs on port 3001)
   cd server
   npm run dev

   # In a new terminal, start the Vite frontend (runs on port 5173)
   cd client
   npm run dev
   ```

## Getting Started (Production)
For production deployments, the system includes a multi-stage `Dockerfile` and a helper deployment script.
We serve the built static React client directly through the Node.js backend.

1. Ensure your `.env` file is populated with production secrets.
2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```
   This will build the Docker image, run the database and server via `docker-compose.prod.yml`, and automatically execute migrations.

## Default Credentials
When the database seeds run, they create default PINs for testing (assuming you haven't changed them):
- **Admin**: `1234`
- **Kitchen Staff**: `4567`
- **Waiter**: `7890`

*Be sure to change these in the Admin Portal for production!*
