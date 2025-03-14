FROM python:3.12-bookworm

# Create a non-root user
RUN useradd -u 1001 -m appuser

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev

COPY requirements.txt .

RUN pip install -r requirements.txt

# Create necessary directories and set permissions
RUN mkdir -p /app/instance && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod 777 /app/instance

USER appuser

COPY . .

ENTRYPOINT ["python", "run.py", "--host=0.0.0.0"]
