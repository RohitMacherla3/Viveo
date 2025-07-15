# Use Node.js LTS Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files (if you have them)
COPY package*.json ./

# Install dependencies and serve
RUN if [ -f package.json ]; then \
        # Install serve globally and project dependencies
        npm install -g serve && \
        if [ -f package-lock.json ]; then \
            npm ci --omit=dev; \
        else \
            npm install --omit=dev; \
        fi; \
    else \
        # Just install serve globally
        npm install -g serve; \
    fi

# Copy all frontend files
COPY . .

# Create a non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start command - serve static files
CMD ["serve", "-s", ".", "-l", "3000"]