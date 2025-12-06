# ==========================================
# Build Stage: Compile TypeScript
# ==========================================
FROM node:18-slim AS builder

WORKDIR /app

# Install system dependencies required for building native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (better layer caching)
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.prod.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy only necessary source code
COPY src/api/ ./src/api/
COPY src/enrichments/ ./src/enrichments/
COPY src/types.ts ./src/types.ts
COPY src/llm/ ./src/llm/
COPY src/db/ ./src/db/

# Build TypeScript to JavaScript using production config
RUN npx tsc --project tsconfig.prod.json

# ==========================================
# Production Stage: Run compiled code
# ==========================================
FROM node:18-slim

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    PORT=8080

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary source files that might be required at runtime
COPY --from=builder /app/src/api/doc ./src/api/doc

# Create placeholder .env file (will be overridden by Cloud Run environment/secrets)
RUN echo "# Environment variables managed by Cloud Run" > .env

# Expose port (Cloud Run will use PORT env var)
EXPOSE 8080

# Health check (Cloud Run uses its own health checking, but good for local testing)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the compiled API server
CMD ["sh", "-c", "PORT=${PORT:-8080} node dist/api/server.js"]
