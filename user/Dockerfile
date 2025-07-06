# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Copy Docker-specific tsconfig
COPY tsconfig.docker.json ./

# Build the application
RUN npx tsc -p tsconfig.docker.json

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built application and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Copy start script
COPY start.sh ./

# Ensure script is executable
RUN chmod +x start.sh

# Expose port
EXPOSE 3002

# Use the start script
CMD ["./start.sh"]