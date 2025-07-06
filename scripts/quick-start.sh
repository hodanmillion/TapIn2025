#!/bin/bash

echo "🚀 Location Chat Application Quick Start"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

echo "✅ docker-compose is installed"
echo ""

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down > /dev/null 2>&1

# Build images
echo "🔨 Building Docker images..."
echo "This may take a few minutes on first run..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi

echo "✅ Images built successfully"
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services. Check the error messages above."
    exit 1
fi

echo ""
echo "⏳ Waiting for services to be ready..."
echo "This may take up to 30 seconds..."

# Wait for services with a progress indicator
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""

# Run health check
echo ""
echo "🏥 Running health check..."
./scripts/health-check.sh

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Application is ready!"
    echo ""
    echo "📱 Access the application at:"
    echo "   Frontend: http://localhost"
    echo ""
    echo "📚 API endpoints:"
    echo "   Auth API: http://localhost:8080"
    echo "   User API: http://localhost:3002"
    echo "   Chat API: http://localhost:3001"
    echo "   Address API: http://localhost:8000"
    echo ""
    echo "📝 View logs: make logs"
    echo "🛑 Stop services: make down"
else
    echo ""
    echo "⚠️  Some services are not ready yet."
    echo "Run 'make logs' to check for errors."
fi