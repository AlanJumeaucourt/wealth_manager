# Build stage
FROM oven/bun:1-slim AS build

WORKDIR /app

# Add ARG for API URL
ARG VITE_API_URL

# Copy package files for better caching
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with production optimization
RUN VITE_API_URL=$VITE_API_URL bun run build

# Production stage
FROM nginx:alpine AS production

# Add non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy nginx template and entrypoint script
COPY nginx.template.conf /etc/nginx/templates/
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy static files
COPY --from=build /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod -R 755 /etc/nginx/templates

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Use our custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
