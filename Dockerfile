# Stage 1: Build the Frontend
# We use a Node.js image to build the React application
FROM node:20-alpine as frontend-builder

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the static files (creates /app/frontend/dist)
RUN npm run build


# Stage 2: Setup the Backend and Final Image
# We use a lightweight Python image for the final container
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend source code
COPY backend/ ./backend/

# Copy the built frontend assets from the previous stage
# This places them exactly where the backend expects them: ../frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Cloud Run injects the PORT environment variable
ENV PORT=8000

# Run the application
# We use shell form to allow $PORT expansion
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
