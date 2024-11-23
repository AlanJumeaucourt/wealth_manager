import os

# Use the environment variable for database path
db_dir = os.environ.get(
    "SQLITE_DB_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance"),
)
db_path = os.path.join(db_dir, "wealth_manager.db")

# Use db_path in your SQLite configuration
