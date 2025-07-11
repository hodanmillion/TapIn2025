#!/bin/bash
set -e

echo "Waiting for database to be ready..."
while ! nc -z postgis 5432; do
  sleep 1
done

echo "Database is ready!"

# Create database if it doesn't exist
PGPASSWORD=postgres psql -h postgis -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'address_hex_db'" | grep -q 1 || PGPASSWORD=postgres psql -h postgis -U postgres -c "CREATE DATABASE address_hex_db"

# Run migrations
echo "Running database migrations..."
cd /app
alembic upgrade head || echo "Migrations failed or already applied"

# Start the application
echo "Starting address service..."
exec uvicorn src.main:app --host 0.0.0.0 --port 8000