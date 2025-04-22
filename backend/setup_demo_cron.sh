#!/bin/bash

# This script sets up a cron job for the demo mode if the environment variables are set

if [ "$DEMO_MODE" = true ]; then
    echo "Demo mode activated, cron job adding fake data will be added"

    # Default values if not specified
    SCHEDULE=${DEMO_CRON_SCHEDULE:-"0 */2 * * *"}
    MONTHS=${DEMO_MONTHS:-48}

    # Create the cron job
    CRON_CMD="$SCHEDULE python3 /app/test/add_api_fake_data.py --months $MONTHS"

    # Add the cron job
    (crontab -l 2>/dev/null || echo "") | grep -v "add_api_fake_data.py" | echo "$CRON_CMD" | crontab -

    # Start cron service
    service cron start

    echo "Demo mode cron job set up with schedule: $SCHEDULE for $MONTHS months of data"

    # Create a background task to run after a delay to ensure API is up
    echo "Will generate initial demo data after API startup..."
    (
        # Wait for the API to be fully up and running (30 seconds delay)
        echo "Waiting for API to start..."
        sleep 30

        # Check if API is responding before generating data
        echo "Checking if API is available..."
        MAX_RETRIES=5
        RETRY_COUNT=0
        API_READY=false

        while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$API_READY" = false ]; do
            if curl -s http://localhost:5000/health | grep -q "ok"; then
                API_READY=true
                echo "API is ready. Generating initial demo data..."
                python3 /app/test/add_api_fake_data.py --months $MONTHS
                echo "Initial demo data generation complete."
            else
                echo "API not ready yet. Retrying in 10 seconds..."
                RETRY_COUNT=$((RETRY_COUNT+1))
                sleep 10
            fi
        done

        if [ "$API_READY" = false ]; then
            echo "WARNING: Could not verify API availability after $MAX_RETRIES attempts. Demo data may not have been generated."
        fi
    ) &

    echo "Demo mode setup complete"
else
    echo "Demo mode not enabled. Skipping cron setup."
fi
