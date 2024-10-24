from app.database import DatabaseManager

def migrate():
    db = DatabaseManager()
    
    # Add the new column
    db.execute_raw_sql("""
        ALTER TABLE transactions 
        ADD COLUMN date_accountability TIMESTAMP;
    """)
    
    # Initialize the new column with the existing date values
    db.execute_raw_sql("""
        UPDATE transactions 
        SET date_accountability = date 
        WHERE date_accountability IS NULL;
    """)

if __name__ == "__main__":
    migrate()
