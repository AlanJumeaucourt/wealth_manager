FROM node:21-slim

# Create a non-root user with explicit UID/GID
RUN groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser

WORKDIR /home

# Install dependencies first
COPY package*.json ./
RUN npm ci && \
    npm install -g expo-cli && \
    npm cache clean --force && \
    # Create necessary directories with correct permissions
    mkdir -p /home/appuser/.expo && \
    mkdir -p /home/node_modules && \
    mkdir -p /home/assets && \
    chown -R appuser:appuser /home && \
    chown -R appuser:appuser /home/appuser

# Switch to non-root user
USER appuser

# Copy application code
COPY --chown=appuser:appuser . .

EXPOSE 19000 19001 19002 8081

CMD ["sh", "-c", "expo start --port 19000 --host 0.0.0.0"]
