FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY migrations ./migrations

EXPOSE 8788

CMD ["node", "src/server.js"]
