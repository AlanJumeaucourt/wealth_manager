# Build stage
FROM oven/bun:1-slim AS build

WORKDIR /app

# Add ARG for API URL
ARG API_URL
ENV VITE_API_URL=$API_URL

# Copy package files for better caching
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with production optimization
RUN bun run build

# Production stage
FROM nginx:alpine AS production

# Add non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set up nginx with external configuration
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set proper permissions
RUN chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid && \
    chmod -R 755 /usr/share/nginx/html

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
