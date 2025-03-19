#!/bin/sh
set -e

# Default values if not provided
export SERVER_NAME=${SERVER_NAME:-localhost}
export API_URL=${API_URL:-http://localhost:5000}
export BACKEND_URL=${BACKEND_URL:-http://flask_backend:5000/}

# For proper CSP resolution, clean URLs to remove protocol
export SERVER_HOST=$(echo ${SERVER_NAME} | sed -E 's/https?:\/\///')
export API_HOST=$(echo ${API_URL} | sed -E 's/https?:\/\///')

# Debug info
echo "Configuring nginx with:"
echo "SERVER_NAME=${SERVER_NAME}"
echo "API_URL=${API_URL}"
echo "BACKEND_URL=${BACKEND_URL}"

# Generate nginx config from template
envsubst '${SERVER_NAME} ${API_URL} ${BACKEND_URL} ${SERVER_HOST} ${API_HOST}' < /etc/nginx/templates/nginx.template.conf > /etc/nginx/conf.d/default.conf

# Show final config for debugging
echo "Generated nginx configuration:"
cat /etc/nginx/conf.d/default.conf

# Execute the CMD from the Dockerfile
exec "$@"
