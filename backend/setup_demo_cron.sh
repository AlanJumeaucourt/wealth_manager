#!/bin/bash

# This script sets up a cron job for the demo mode if the environment variables are set

if [ "$DEMO_MODE" = "true" ]; then
    echo "Setting up demo mode cron job..."

    # Default values if not specified
    SCHEDULE=${DEMO_CRON_SCHEDULE:-"0 */2 * * *"}
    MONTHS=${DEMO_MONTHS:-48}

    # Install cron
    apt-get update && apt-get install -y cron

    # Create the cron job
    CRON_CMD="$SCHEDULE python3 /app/test/add_api_fake_data.py --months $MONTHS"

    # Add the cron job
    (crontab -l 2>/dev/null || echo "") | grep -v "add_api_fake_data.py" | echo "$CRON_CMD" | crontab -

    # Start cron service
    service cron start

    echo "Demo mode cron job set up with schedule: $SCHEDULE for $MONTHS months of data"

    # Run once immediately to populate initial data
    echo "Generating initial demo data..."
    python3 /app/test/add_api_fake_data.py --months $MONTHS

    echo "Demo mode setup complete"
else
    echo "Demo mode not enabled. Skipping cron setup."
fi
