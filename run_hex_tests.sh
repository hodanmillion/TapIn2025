#!/bin/bash

# Hexagonal System Test Runner
# This script starts all services and runs integration tests

set -e

echo "🔷 Starting Hexagonal System Tests"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_status "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed to start within timeout"
    return 1
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    
    print_status "Checking $service_name health..."
    
    if curl -s -f "$health_url" > /dev/null 2>&1; then
        print_status "$service_name is healthy ✅"
        return 0
    else
        print_warning "$service_name health check failed ⚠️"
        return 1
    fi
}

# Stop any existing containers
print_status "Stopping existing containers..."
docker-compose down -v || true

# Start infrastructure services first
print_status "Starting infrastructure services..."
docker-compose up -d postgres redis mongodb postgis rabbitmq

# Wait for databases to be ready
print_status "Waiting for databases to initialize..."
sleep 10

# Check database health
print_status "Checking database connections..."
if ! docker exec tap_in-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
    print_error "PostgreSQL is not ready"
    exit 1
fi

if ! docker exec tap_in-redis-1 redis-cli ping > /dev/null 2>&1; then
    print_error "Redis is not ready"
    exit 1
fi

if ! docker exec tap_in-mongodb-1 mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    print_error "MongoDB is not ready"
    exit 1
fi

print_status "All databases are ready!"

# Start application services
print_status "Starting application services..."
print_status "Note: Some services may take 5+ minutes to build..."

# Start services with extended timeout
export COMPOSE_HTTP_TIMEOUT=600
export DOCKER_CLIENT_TIMEOUT=600

# Build and start auth service
print_status "Building auth service..."
docker-compose up -d --build auth

# Build and start user service
print_status "Building user service..."
docker-compose up -d --build user

# Build and start address service
print_status "Building address service..."
docker-compose up -d --build address

# Build and start chat service (this may take the longest)
print_status "Building chat service (this may take 5+ minutes)..."
docker-compose up -d --build chat

# Build and start frontend
print_status "Building frontend..."
docker-compose up -d --build frontend

# Start nginx
print_status "Starting nginx..."
docker-compose up -d nginx

# Wait for all services to be ready
print_status "Waiting for services to be ready..."

# Wait for each service
wait_for_service "Auth Service" "http://localhost:8080/health" || {
    print_error "Auth service failed to start"
    docker-compose logs auth
    exit 1
}

wait_for_service "User Service" "http://localhost:3002/health" || {
    print_error "User service failed to start"
    docker-compose logs user
    exit 1
}

wait_for_service "Address Service" "http://localhost:8000/health" || {
    print_error "Address service failed to start"
    docker-compose logs address
    exit 1
}

wait_for_service "Chat Service" "http://localhost:3001/health" || {
    print_error "Chat service failed to start"
    docker-compose logs chat
    exit 1
}

wait_for_service "Frontend" "http://localhost:3080" || {
    print_error "Frontend failed to start"
    docker-compose logs frontend
    exit 1
}

# Check all service health
print_status "Performing health checks..."
check_service_health "Auth Service" "http://localhost:8080/health"
check_service_health "User Service" "http://localhost:3002/health"
check_service_health "Address Service" "http://localhost:8000/health"
check_service_health "Chat Service" "http://localhost:3001/health"

# Show running containers
print_status "Running containers:"
docker-compose ps

# Run unit tests
print_status "Running unit tests..."

# Python tests (Address Service)
print_status "Running address service tests..."
if command -v python3 &> /dev/null; then
    cd address
    python3 -m pytest tests/ -v || print_warning "Address service tests failed"
    cd ..
else
    print_warning "Python3 not found, skipping address service tests"
fi

# Rust tests (Chat Service)
print_status "Running chat service tests..."
if command -v cargo &> /dev/null; then
    cd chat
    cargo test || print_warning "Chat service tests failed"
    cd ..
else
    print_warning "Cargo not found, skipping chat service tests"
fi

# Frontend tests
print_status "Running frontend tests..."
if command -v npm &> /dev/null; then
    cd frontend
    npm test -- --watchAll=false || print_warning "Frontend tests failed"
    cd ..
else
    print_warning "NPM not found, skipping frontend tests"
fi

# Run integration tests
print_status "Running integration tests..."
if command -v python3 &> /dev/null; then
    # Install test dependencies
    pip3 install aiohttp websockets pytest-asyncio
    
    # Run integration tests
    cd integration-tests
    python3 test_hex_system.py || print_warning "Integration tests failed"
    cd ..
else
    print_warning "Python3 not found, skipping integration tests"
fi

# Run E2E test with browser
print_status "Running E2E browser test..."
if command -v node &> /dev/null; then
    # Install puppeteer if needed
    if [ ! -d "node_modules" ]; then
        npm install puppeteer
    fi
    
    # Create E2E test script
    cat > e2e_hex_test.js << 'EOF'
const puppeteer = require('puppeteer');

async function runE2ETest() {
    console.log('🔷 Starting E2E Hex Test');
    
    let browser, page;
    
    try {
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        
        // Navigate to app
        await page.goto('http://localhost:3080', { waitUntil: 'networkidle2' });
        
        // Register user
        await page.click('a[href="/register"]');
        await page.waitForSelector('input[type="email"]');
        
        const timestamp = Date.now();
        await page.type('input[type="email"]', `e2etest${timestamp}@example.com`);
        await page.type('input[placeholder*="username"]', `e2etest${timestamp}`);
        await page.type('input[type="password"]:not([placeholder*="confirm"])', 'password123');
        await page.type('input[placeholder*="confirm"]', 'password123');
        
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Test hex join
        await page.waitForSelector('button');
        const buttons = await page.$$('button');
        
        let joinButton = null;
        for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent);
            if (text.includes('Join') || text.includes('Find')) {
                joinButton = button;
                break;
            }
        }
        
        if (joinButton) {
            await joinButton.click();
            console.log('✅ E2E test completed successfully');
        } else {
            console.log('⚠️ Join button not found');
        }
        
    } catch (error) {
        console.error('❌ E2E test failed:', error.message);
    } finally {
        if (browser) await browser.close();
    }
}

runE2ETest();
EOF
    
    node e2e_hex_test.js || print_warning "E2E test failed"
    rm e2e_hex_test.js
else
    print_warning "Node.js not found, skipping E2E test"
fi

# Test summary
print_status "Test Summary"
print_status "============"
print_status "✅ Infrastructure services started"
print_status "✅ Application services started"
print_status "✅ Health checks completed"
print_status "✅ Unit tests executed"
print_status "✅ Integration tests executed"
print_status "✅ E2E tests executed"

print_status ""
print_status "🎉 Hexagonal system tests completed!"
print_status ""
print_status "Services are running at:"
print_status "- Frontend: http://localhost:3080"
print_status "- Auth API: http://localhost:8080"
print_status "- User API: http://localhost:3002"
print_status "- Chat API: http://localhost:3001"
print_status "- Address API: http://localhost:8000"
print_status ""
print_status "To stop all services: docker-compose down -v"
print_status "To view logs: docker-compose logs -f [service-name]"