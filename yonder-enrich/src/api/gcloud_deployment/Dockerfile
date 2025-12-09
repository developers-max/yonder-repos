# ==========================================
# Build Stage: Compile TypeScript with pnpm monorepo
# ==========================================
FROM node:18-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install system dependencies required for building native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy root workspace files first (better layer caching)
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy yonder-enrich package files
COPY yonder-enrich/package.json ./yonder-enrich/
COPY yonder-enrich/tsconfig.json ./yonder-enrich/
COPY yonder-enrich/tsconfig.prod.json ./yonder-enrich/

# Copy yonder-persistence package (workspace dependency)
COPY packages/yonder-persistence/ ./packages/yonder-persistence/

# Install ALL dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Build yonder-persistence first (it's a dependency)
RUN cd packages/yonder-persistence && pnpm build

# Copy yonder-enrich source code
COPY yonder-enrich/src/api/ ./yonder-enrich/src/api/
COPY yonder-enrich/src/enrichments/ ./yonder-enrich/src/enrichments/
COPY yonder-enrich/src/layers/ ./yonder-enrich/src/layers/
COPY yonder-enrich/src/types.ts ./yonder-enrich/src/types.ts
COPY yonder-enrich/src/llm/ ./yonder-enrich/src/llm/
COPY yonder-enrich/src/db/ ./yonder-enrich/src/db/

# Build yonder-enrich TypeScript to JavaScript
RUN cd yonder-enrich && pnpm exec tsc --project tsconfig.prod.json

# ==========================================
# Production Stage: Run compiled code
# ==========================================
FROM node:18-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    PORT=8080

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy root workspace files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy yonder-enrich package.json
COPY yonder-enrich/package.json ./yonder-enrich/

# Copy yonder-persistence package.json and built dist
COPY packages/yonder-persistence/package.json ./packages/yonder-persistence/
COPY --from=builder /app/packages/yonder-persistence/dist ./packages/yonder-persistence/dist

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled yonder-enrich application from builder stage
COPY --from=builder /app/yonder-enrich/dist ./yonder-enrich/dist

# Copy necessary source files that might be required at runtime
COPY --from=builder /app/yonder-enrich/src/api/doc ./yonder-enrich/src/api/doc

# Create placeholder .env file (will be overridden by Cloud Run environment/secrets)
RUN echo "# Environment variables managed by Cloud Run" > .env

# Set working directory to yonder-enrich
WORKDIR /app/yonder-enrich

# Expose port (Cloud Run will use PORT env var)
EXPOSE 8080

# Health check (Cloud Run uses its own health checking, but good for local testing)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the compiled API server
CMD ["sh", "-c", "PORT=${PORT:-8080} node dist/api/server.js"]
