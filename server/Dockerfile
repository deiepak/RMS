FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN apk add --no-cache ffmpeg

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
