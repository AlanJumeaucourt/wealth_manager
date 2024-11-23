FROM python:3.12-slim

# Install curl for healthcheck and sqlite3 for database
RUN apt-get update && \
    apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user with explicit UID/GID
RUN groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser

WORKDIR /app

# Install dependencies first to leverage cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    rm -rf /root/.cache/pip/*

# Create instance directory and set permissions
RUN mkdir -p /app/instance && \
    chown -R appuser:appuser /app && \
    chmod 777 /app/instance

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Environment variables
ENV FLASK_APP=app.py \
    FLASK_ENV=development \
    FLASK_DEBUG=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0"]
