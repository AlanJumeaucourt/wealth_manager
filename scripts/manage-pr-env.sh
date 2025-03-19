#!/bin/bash

PR_NUMBER=$1
ACTION=$2

if [ -z "$PR_NUMBER" ] || [ -z "$ACTION" ]; then
    echo "Usage: $0 <pr-number> <start|stop>"
    exit 1
fi

ENVIRONMENT="pr-${PR_NUMBER}"
DOMAIN="pr-${PR_NUMBER}.100.121.97.42.sslip.io"

case $ACTION in
    "start")
        # Create override file
        cat > docker-compose.override.yml <<EOL
version: "3.8"
services:
  web_application:
    container_name: ${ENVIRONMENT}_web_application
    environment:
      - DOMAIN=${DOMAIN}
  flask_backend:
    container_name: ${ENVIRONMENT}_flask_backend
networks:
  app-network:
    name: wealth_manager_${ENVIRONMENT}_network
volumes:
  sqlite_data:
    name: wealth_manager_${ENVIRONMENT}_db
EOL

        # Start the environment
        export ENVIRONMENT=$ENVIRONMENT
        export DOMAIN=$DOMAIN
        docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d
        ;;

    "stop")
        # Stop the environment
        export ENVIRONMENT=$ENVIRONMENT
        docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml down

        # Cleanup resources
        docker volume rm wealth_manager_${ENVIRONMENT}_db || true
        docker network rm wealth_manager_${ENVIRONMENT}_network || true
        rm -f docker-compose.override.yml
        ;;

    *)
        echo "Invalid action. Use 'start' or 'stop'"
        exit 1
        ;;
esac
