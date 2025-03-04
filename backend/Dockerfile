FROM python:3.12-slim

# Install curl for healthcheck and sqlite3 for database
RUN apt-get update && \
    apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser --gid 1001 && \
    useradd -r -g appuser --uid 1001 -m appuser

WORKDIR /app

# Enable bytecode compilation and system Python for better performance
ENV UV_COMPILE_BYTECODE=1 \
    UV_SYSTEM_PYTHON=1

# Set up permissions for the app directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy pyproject.toml and install dependencies
COPY --chown=appuser:appuser pyproject.toml uv.lock .

# Clean any existing venv and run sync
RUN rm -rf /app/.venv && \
    uv sync --frozen

# Copy application code
COPY --chown=appuser:appuser . .

EXPOSE 5000

CMD ["uv", "run", "run.py", "--host=0.0.0.0"]
