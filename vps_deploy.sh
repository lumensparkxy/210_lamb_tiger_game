#!/bin/bash

# Exit on error
set -e

echo "🚀 Deploying to VPS..."

# 1. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# 2. Build and Run
echo "📦 Building and Starting Containers..."
# This builds the image locally on the VPS and starts it
docker compose up -d --build

echo "✅ Deployment Complete!"
echo "🌍 Your app should be running on http://YOUR_SERVER_IP:8000"
