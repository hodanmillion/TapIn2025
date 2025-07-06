#!/bin/bash

echo "Checking service health..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local name=$1
    local url=$2
    
    if curl -f -s "$url" > /dev/null; then
        echo -e "${GREEN}✅ $name is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not responding${NC}"
        return 1
    fi
}

# Check each service
all_healthy=true

check_service "Frontend" "http://localhost/health" || all_healthy=false
check_service "Auth Service" "http://localhost:8080/health" || all_healthy=false
check_service "User Service" "http://localhost:3002/health" || all_healthy=false
check_service "Chat Service" "http://localhost:3001/health" || all_healthy=false
check_service "Address Service" "http://localhost:8000/health" || all_healthy=false

echo ""

# Check databases
echo "Checking databases..."

# PostgreSQL
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
    all_healthy=false
fi

# PostGIS
if docker-compose exec -T postgis pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostGIS is ready${NC}"
else
    echo -e "${RED}❌ PostGIS is not ready${NC}"
    all_healthy=false
fi

# Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
else
    echo -e "${RED}❌ Redis is not ready${NC}"
    all_healthy=false
fi

# MongoDB
if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is ready${NC}"
else
    echo -e "${RED}❌ MongoDB is not ready${NC}"
    all_healthy=false
fi

echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}All services are healthy!${NC}"
    echo ""
    echo "You can access the application at:"
    echo "  Frontend: http://localhost"
    echo "  API Documentation:"
    echo "    - Auth: http://localhost:8080/api-docs"
    echo "    - User: http://localhost:3002/api-docs"
    exit 0
else
    echo -e "${RED}Some services are not healthy. Check logs with: make logs${NC}"
    exit 1
fi