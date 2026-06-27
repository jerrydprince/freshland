#!/bin/bash

# ==============================================================================
# SPARKLES APARTMENTS - MULTI-DOMAIN DEPLOYMENT SCRIPT
# ==============================================================================
# This script automates building and deploying the frontend and backend 
# across different environments/domains.
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e

ENV_NAME=${1:-production}
echo "🚀 Starting Deployment for environment: $ENV_NAME"

# 1. Load configuration for the domain/environment
if [ -f ".env.$ENV_NAME" ]; then
    echo "📦 Loading configuration from .env.$ENV_NAME"
    export $(cat .env.$ENV_NAME | grep -v '^#' | xargs)
else
    echo "⚠️  No specific environment file (.env.$ENV_NAME) found. Make sure you have configured one based on .env.example"
fi

# 2. Deploy Backend
echo "⚙️  Setting up Backend..."
cd backend
npm install --production

# If using PM2 to manage the backend, restart the process
if command -v pm2 &> /dev/null; then
    # Ensure backend uses the correct environment variables
    # The --update-env flag is critical for multi-domain switches
    pm2 restart sparkles-backend --update-env || pm2 start server.js --name sparkles-backend
else
    echo "⚠️  PM2 not found. Backend must be started manually (e.g. node server.js)"
fi
cd ..

# 3. Deploy Frontend (Vite Build)
echo "🎨 Building Frontend..."
cd frontend
npm install

# Build the frontend with the injected environment variables
# Vite automatically picks up variables prefixed with VITE_
npm run build

echo "✅ Frontend build complete. Assets are located in frontend/dist."
echo "🔄 If using a web server (Nginx/Apache), ensure the webroot points to frontend/dist."

cd ..
echo "🎉 Deployment for $ENV_NAME completed successfully!"
