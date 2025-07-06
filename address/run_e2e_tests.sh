#!/bin/bash
set -e

echo "🧪 END-TO-END TEST RUNNER"
echo "========================="

# Check if services are running
check_service() {
    local service_name=$1
    local port=$2
    
    echo "🔍 Checking $service_name on port $port..."
    
    if curl -s "http://localhost:$port/health/" > /dev/null 2>&1; then
        echo "✅ $service_name is running"
        return 0
    else
        echo "❌ $service_name is not running"
        return 1
    fi
}

# Function to start services
start_services() {
    echo "🚀 Starting services..."
    
    # Start database
    echo "🐳 Starting PostgreSQL with PostGIS..."
    docker-compose up -d postgres
    
    # Wait for database
    echo "⏳ Waiting for database to be ready..."
    sleep 10
    
    # Start application in background
    echo "🌐 Starting address service..."
    source .venv/bin/activate
    python run.py &
    APP_PID=$!
    
    # Wait for app to start
    echo "⏳ Waiting for application to be ready..."
    sleep 15
    
    # Check if app is running
    if check_service "Address Service" 8000; then
        echo "✅ All services started successfully"
        return 0
    else
        echo "❌ Failed to start services"
        return 1
    fi
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping services..."
    
    # Stop application
    if [ ! -z "$APP_PID" ]; then
        echo "🔄 Stopping address service (PID: $APP_PID)..."
        kill $APP_PID 2>/dev/null || true
    fi
    
    # Stop database
    echo "🐳 Stopping PostgreSQL..."
    docker-compose down
    
    echo "✅ Services stopped"
}

# Function to run tests
run_tests() {
    echo "🧪 Running E2E tests..."
    
    source .venv/bin/activate
    python test_e2e.py
    
    return $?
}

# Main execution
main() {
    local start_services_flag=false
    local stop_services_flag=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --start-services)
                start_services_flag=true
                shift
                ;;
            --stop-services)
                stop_services_flag=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --start-services    Start required services before testing"
                echo "  --stop-services     Stop services after testing"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if services are already running
    if check_service "Address Service" 8000; then
        echo "✅ Services already running"
    else
        if [ "$start_services_flag" = true ]; then
            start_services
        else
            echo "❌ Services not running"
            echo "💡 Options:"
            echo "   1. Start services manually: docker-compose up -d && python run.py"
            echo "   2. Use --start-services flag to auto-start"
            exit 1
        fi
    fi
    
    # Run tests
    if run_tests; then
        echo ""
        echo "🎉 ALL E2E TESTS PASSED!"
        echo "✅ Address service is production-ready"
        test_result=0
    else
        echo ""
        echo "❌ SOME E2E TESTS FAILED"
        echo "💡 Check the output above for details"
        test_result=1
    fi
    
    # Stop services if requested
    if [ "$stop_services_flag" = true ]; then
        stop_services
    fi
    
    exit $test_result
}

# Trap to ensure cleanup on exit
trap 'stop_services' EXIT

# Run main function
main "$@"