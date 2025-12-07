# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from root
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy server source code
COPY server/ ./server/

# Copy public folder for widget files
COPY public/ ./public/

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

# Copy application code from builder
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads/whitelabel && \
    mkdir -p /app/uploads/knowledge && \
    mkdir -p /app/uploads/temp

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/test', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application with dumb-init
CMD ["dumb-init", "node", "server.js"]
