#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment Script..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# 2. Setup Backend
echo "🐍 Setting up Backend..."
cd backend
# Ideally use a virtual environment here, but for simple deployment scripts 
# or containers, installing to system/user is common.
# If using a specific venv, activate it here: source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Run Server
echo "🔥 Starting Server..."
# In production, you might want to use gunicorn with uvicorn workers:
# gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app
# But for a small app, uvicorn is sufficient.
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
