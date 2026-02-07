# Stage 1: Build the React Client
FROM node:18-alpine as client-builder
WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN npm install

# Copy client source code
COPY client/ .
RUN npm run build


# Stage 2: Setup the Server
FROM node:18-alpine
WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./
RUN npm install --production

# Copy server source code
COPY server/ .

# Copy built frontend assets from Stage 1
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "index-minimal.js"]
