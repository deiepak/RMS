# Stage 1: Build the React client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build and run the Node.js server
FROM node:20-alpine
WORKDIR /app/server

# Install server dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy server source code
COPY server/ ./

# Copy built client assets to the location the server expects
COPY --from=client-build /app/client/dist /app/client/dist

# Expose API port
EXPOSE 3001

# Run the server in production mode
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
