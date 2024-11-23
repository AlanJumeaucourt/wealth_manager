from app import create_app

app = create_app()

# Use Gunicorn to run this application in production
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
