FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN useradd --user-group --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /usr/src/app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index-minimal.js"]
