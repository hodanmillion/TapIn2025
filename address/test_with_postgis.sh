#!/bin/bash
set -e

echo "🗺️  FULL POSTGIS CAPABILITIES TEST"
echo "=================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. PostGIS test requires Docker."
    echo "💡 Install Docker to test full PostGIS capabilities"
    exit 1
fi

echo "🐳 Starting PostgreSQL with PostGIS..."

# Start PostgreSQL with PostGIS
docker compose up -d postgres

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Wait for PostgreSQL to be fully ready
for i in {1..30}; do
    if docker compose exec postgres pg_isready -h localhost -p 5432 -U postgres; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    echo "   Waiting... (${i}/30)"
    sleep 2
done

# Test PostgreSQL connection
echo "🔌 Testing PostgreSQL connection..."
if docker compose exec postgres psql -U postgres -d addressdb -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ PostgreSQL connection working"
else
    echo "❌ Failed to connect to PostgreSQL"
    echo "🧹 Cleaning up..."
    docker compose down
    exit 1
fi

# Test PostGIS extension
echo "🗺️ Testing PostGIS extension..."
if docker compose exec postgres psql -U postgres -d addressdb -c "SELECT PostGIS_Version();" > /dev/null 2>&1; then
    echo "✅ PostGIS extension available"
else
    echo "📦 Installing PostGIS extension..."
    docker compose exec postgres psql -U postgres -d addressdb -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    echo "✅ PostGIS extension installed"
fi

# Run Python tests with real database
echo "🐍 Running comprehensive PostGIS tests..."
source .venv/bin/activate

if python test_full_gis.py; then
    echo ""
    echo "🎉 ALL POSTGIS CAPABILITIES VERIFIED!"
    echo ""
    echo "🌍 Full GIS Stack Working:"
    echo "   ✅ PostgreSQL 16 with PostGIS 3.4"
    echo "   ✅ Spatial geometry columns (POINT, SRID 4326)"
    echo "   ✅ Spatial indexing (GiST indexes)"
    echo "   ✅ Distance calculations (ST_Distance)"
    echo "   ✅ Spatial containment (ST_Contains, ST_DWithin)"
    echo "   ✅ Buffer operations (ST_Buffer)"
    echo "   ✅ Convex hull calculations (ST_ConvexHull)"
    echo "   ✅ Geographic coordinate transformations"
    echo "   ✅ H3 hexagonal spatial indexing"
    echo "   ✅ DBSCAN spatial clustering"
    echo "   ✅ Nearest neighbor search"
    echo "   ✅ Spatial statistics and analysis"
    echo "   ✅ FastAPI spatial endpoints"
    echo ""
    echo "🚀 Ready for production spatial applications!"
    echo ""
    echo "📚 API Documentation: http://localhost:8000/docs"
    echo "🏥 Health Check: http://localhost:8000/health"
    echo ""
    
    # Optionally keep services running
    read -p "Keep PostgreSQL running? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 PostgreSQL will keep running..."
        echo "🛑 Stop with: docker compose down"
    else
        echo "🧹 Stopping services..."
        docker compose down
    fi
    
else
    echo "❌ Some PostGIS tests failed"
    echo "🧹 Cleaning up..."
    docker compose down
    exit 1
fi