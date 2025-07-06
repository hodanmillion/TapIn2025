#!/bin/bash
set -e

echo "Address service starting..."

# Wait for PostgreSQL/PostGIS to be ready
echo "Waiting for PostgreSQL/PostGIS to be ready..."
until pg_isready -h postgis -p 5432 -U postgres; do
  echo "PostgreSQL is not ready yet..."
  sleep 2
done

echo "PostgreSQL is ready!"

# Start the application
echo "Starting Python application..."
exec python run.py