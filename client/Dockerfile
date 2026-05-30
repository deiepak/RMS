FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Run Vite dev server and expose it on the local network
CMD ["npm", "run", "dev", "--", "--host"]
