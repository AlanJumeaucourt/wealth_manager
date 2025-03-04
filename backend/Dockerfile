FROM python:3.12-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
    curl \
    sqlite3 \
    libsqlite3-dev

COPY requirements.txt .

RUN pip install -r requirements.txt

WORKDIR /app


COPY . .


ENTRYPOINT ["python", "run.py", "--host=0.0.0.0"]
