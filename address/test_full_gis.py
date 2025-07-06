#!/usr/bin/env python3
"""
Comprehensive PostGIS capabilities test
Tests full spatial database functionality
"""
import asyncio
import sys
from typing import List
import json

async def test_database_connection():
    """Test PostgreSQL connection and PostGIS extension"""
    print("🔌 Testing database connection...")
    
    try:
        from src.database import engine
        from sqlalchemy import text
        
        async with engine.begin() as conn:
            # Test basic connection
            result = await conn.execute(text("SELECT version()"))
            pg_version = result.scalar()
            print(f"   PostgreSQL: {pg_version.split(',')[0]}")
            
            # Test PostGIS extension
            result = await conn.execute(text("SELECT PostGIS_Version()"))
            postgis_version = result.scalar()
            print(f"   PostGIS: {postgis_version}")
            
            # Test spatial functions
            result = await conn.execute(text("""
                SELECT ST_AsText(ST_Point(-74.0060, 40.7128))
            """))
            point_wkt = result.scalar()
            print(f"   Spatial function test: {point_wkt}")
            
        print("✅ Database connection and PostGIS working")
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Start PostgreSQL with: docker compose up -d postgres")
        return False

async def test_database_initialization():
    """Test database schema creation"""
    print("🗄️ Testing database initialization...")
    
    try:
        from src.database import init_db, engine
        from sqlalchemy import text
        
        # Initialize database
        await init_db()
        
        # Check that locations table exists
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT column_name, data_type, udt_name 
                FROM information_schema.columns 
                WHERE table_name = 'locations'
                ORDER BY ordinal_position
            """))
            
            columns = result.fetchall()
            print("   Table structure:")
            for col in columns:
                print(f"     {col.column_name}: {col.data_type} ({col.udt_name})")
            
            # Check spatial index
            result = await conn.execute(text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'locations' 
                AND indexdef LIKE '%gist%'
            """))
            
            spatial_indexes = result.fetchall()
            print(f"   Spatial indexes: {len(spatial_indexes)}")
            for idx in spatial_indexes:
                print(f"     {idx.indexname}")
        
        print("✅ Database schema initialized correctly")
        return True
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

async def create_test_locations():
    """Create test locations for spatial operations"""
    print("📍 Creating test locations...")
    
    try:
        from src.services.address_service import AddressService
        from src.database import get_db
        
        # Test locations in NYC area
        test_addresses = [
            {
                'place_id': 'test_empire_state',
                'address_string': 'Empire State Building, New York, NY',
                'coordinates': {'latitude': 40.7484, 'longitude': -73.9857},
                'components': {
                    'street_name': 'Fifth Avenue',
                    'street_number': '350',
                    'city': 'New York',
                    'state': 'NY',
                    'country': 'US',
                    'postal_code': '10118'
                }
            },
            {
                'place_id': 'test_central_park',
                'address_string': 'Central Park, New York, NY',
                'coordinates': {'latitude': 40.7829, 'longitude': -73.9654},
                'components': {
                    'street_name': 'Central Park',
                    'city': 'New York',
                    'state': 'NY',
                    'country': 'US'
                }
            },
            {
                'place_id': 'test_brooklyn_bridge',
                'address_string': 'Brooklyn Bridge, New York, NY',
                'coordinates': {'latitude': 40.7061, 'longitude': -73.9969},
                'components': {
                    'street_name': 'Brooklyn Bridge',
                    'city': 'New York',
                    'state': 'NY',
                    'country': 'US'
                }
            },
            {
                'place_id': 'test_times_square',
                'address_string': 'Times Square, New York, NY',
                'coordinates': {'latitude': 40.7580, 'longitude': -73.9855},
                'components': {
                    'street_name': 'Broadway',
                    'city': 'New York',
                    'state': 'NY',
                    'country': 'US',
                    'postal_code': '10036'
                }
            },
            {
                'place_id': 'test_statue_liberty',
                'address_string': 'Statue of Liberty, New York, NY',
                'coordinates': {'latitude': 40.6892, 'longitude': -74.0445},
                'components': {
                    'street_name': 'Liberty Island',
                    'city': 'New York',
                    'state': 'NY',
                    'country': 'US'
                }
            }
        ]
        
        address_service = AddressService()
        created_locations = []
        
        async for db in get_db():
            for addr_data in test_addresses:
                location = await address_service._create_location_from_geocode(addr_data, db)
                created_locations.append(location)
                print(f"   Created: {location.address_string}")
            break
        
        print(f"✅ Created {len(created_locations)} test locations")
        return created_locations
        
    except Exception as e:
        print(f"❌ Failed to create test locations: {e}")
        return []

async def test_spatial_queries():
    """Test PostGIS spatial queries"""
    print("🗺️ Testing spatial queries...")
    
    try:
        from src.models import Coordinates
        from src.services.address_service import AddressService
        from src.database import get_db
        
        address_service = AddressService()
        
        # Test point: Empire State Building area
        search_coords = Coordinates(latitude=40.7484, longitude=-73.9857)
        
        async for db in get_db():
            # Test nearby search with different radii
            radii = [500, 1000, 2000]  # meters
            
            for radius in radii:
                nearby = await address_service.find_locations_near(
                    search_coords, radius, 10, db
                )
                
                print(f"   Within {radius}m: {len(nearby)} locations")
                for loc in nearby:
                    distance = loc.distance_meters
                    print(f"     {loc.location.address_string}: {distance:.0f}m")
            
            break
        
        print("✅ Spatial queries working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Spatial queries failed: {e}")
        return False

async def test_spatial_functions():
    """Test advanced PostGIS spatial functions"""
    print("🔧 Testing advanced spatial functions...")
    
    try:
        from src.database import engine
        from sqlalchemy import text
        
        async with engine.begin() as conn:
            # Test distance calculation
            result = await conn.execute(text("""
                SELECT 
                    l1.address_string as from_location,
                    l2.address_string as to_location,
                    ST_Distance(
                        l1.coordinates::geography,
                        l2.coordinates::geography
                    ) as distance_meters
                FROM locations l1, locations l2
                WHERE l1.place_id = 'test_empire_state'
                AND l2.place_id = 'test_central_park'
            """))
            
            distance_result = result.fetchone()
            if distance_result:
                print(f"   Distance calculation:")
                print(f"     {distance_result.from_location} to {distance_result.to_location}")
                print(f"     Distance: {distance_result.distance_meters:.0f} meters")
            
            # Test buffer operation
            result = await conn.execute(text("""
                SELECT ST_AsText(ST_Buffer(coordinates::geography, 1000)::geometry)
                FROM locations 
                WHERE place_id = 'test_empire_state'
                LIMIT 1
            """))
            
            buffer_result = result.scalar()
            if buffer_result:
                print(f"   Buffer operation: Generated polygon with {len(buffer_result)} characters")
            
            # Test spatial containment
            result = await conn.execute(text("""
                SELECT 
                    COUNT(*) as locations_in_buffer
                FROM locations l1, locations l2
                WHERE l1.place_id = 'test_central_park'
                AND ST_Contains(
                    ST_Buffer(l1.coordinates::geography, 2000)::geometry,
                    l2.coordinates
                )
            """))
            
            containment_result = result.scalar()
            print(f"   Spatial containment: {containment_result} locations within 2km of Central Park")
            
            # Test convex hull
            result = await conn.execute(text("""
                SELECT ST_AsText(ST_ConvexHull(ST_Collect(coordinates)))
                FROM locations
            """))
            
            hull_result = result.scalar()
            if hull_result:
                print(f"   Convex hull: Generated for all locations")
        
        print("✅ Advanced spatial functions working")
        return True
        
    except Exception as e:
        print(f"❌ Advanced spatial functions failed: {e}")
        return False

async def test_spatial_analysis_service():
    """Test spatial analysis service with real data"""
    print("📊 Testing spatial analysis service...")
    
    try:
        from src.services.spatial_service import SpatialAnalysisService
        from src.services.address_service import AddressService
        from src.database import get_db
        
        spatial_service = SpatialAnalysisService()
        address_service = AddressService()
        
        async for db in get_db():
            # Get all test locations
            from sqlalchemy import select
            from src.database import Location
            
            result = await db.execute(select(Location))
            locations_db = result.scalars().all()
            locations = [address_service._to_response(loc) for loc in locations_db]
            
            if not locations:
                print("   No locations found for analysis")
                return False
            
            print(f"   Analyzing {len(locations)} locations")
            
            # Test clustering
            clusters = spatial_service.find_clusters(locations, eps_meters=1000, min_samples=2)
            print(f"   Found {len(clusters)} clusters")
            
            for i, cluster in enumerate(clusters):
                print(f"     Cluster {i}: {len(cluster.locations)} locations, "
                      f"radius: {cluster.radius_meters:.0f}m, "
                      f"density: {cluster.density:.2f}/km²")
            
            # Test H3 heatmap
            density_map = spatial_service.create_h3_heatmap(locations, resolution=9)
            print(f"   H3 heatmap: {len(density_map)} hexagons")
            
            # Test spatial statistics
            stats = spatial_service.calculate_spatial_statistics(locations)
            print(f"   Spatial statistics:")
            print(f"     Total locations: {stats['total_locations']}")
            print(f"     Coverage area: {stats['coverage_area_sqkm']:.3f} km²")
            print(f"     Density: {stats['density_per_sqkm']:.1f} locations/km²")
            print(f"     Mean nearest neighbor: {stats['mean_nearest_neighbor_distance']:.0f}m")
            print(f"     Distribution: {stats['spatial_distribution']}")
            
            # Test nearest neighbors
            from src.models import Coordinates
            target = Coordinates(latitude=40.7580, longitude=-73.9855)  # Times Square
            nearest = spatial_service.find_nearest_neighbors(target, locations, k=3)
            
            print(f"   Nearest neighbors to Times Square:")
            for loc, dist in nearest:
                print(f"     {loc.address_string}: {dist:.0f}m")
            
            break
        
        print("✅ Spatial analysis service working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Spatial analysis failed: {e}")
        return False

async def test_api_endpoints():
    """Test spatial API endpoints"""
    print("🌐 Testing API endpoints...")
    
    try:
        from fastapi.testclient import TestClient
        from src.main import app
        from unittest.mock import patch, AsyncMock
        
        # Mock database dependency
        mock_locations = []
        
        async def mock_get_db():
            yield AsyncMock()
        
        # Test with mocked endpoints
        client = TestClient(app)
        
        # Test health endpoint
        response = client.get("/health/")
        assert response.status_code == 200
        data = response.json()
        print(f"   Health endpoint: {data['status']}")
        
        # Test OpenAPI spec
        response = client.get("/openapi.json")
        assert response.status_code == 200
        spec = response.json()
        
        # Count spatial endpoints
        spatial_paths = [path for path in spec['paths'].keys() if 'spatial' in path]
        address_paths = [path for path in spec['paths'].keys() if 'addresses' in path]
        
        print(f"   API specification loaded")
        print(f"   Address endpoints: {len(address_paths)}")
        print(f"   Spatial endpoints: {len(spatial_paths)}")
        
        # Test docs endpoint
        response = client.get("/docs")
        assert response.status_code == 200
        print(f"   Documentation available at /docs")
        
        print("✅ API endpoints configured correctly")
        return True
        
    except Exception as e:
        print(f"❌ API endpoint test failed: {e}")
        return False

async def cleanup_test_data():
    """Clean up test data"""
    print("🧹 Cleaning up test data...")
    
    try:
        from src.database import engine
        from sqlalchemy import text
        
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                DELETE FROM locations WHERE place_id LIKE 'test_%'
            """))
            deleted_count = result.rowcount
            print(f"   Deleted {deleted_count} test locations")
        
        print("✅ Test data cleaned up")
        return True
        
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        return False

async def main():
    """Run comprehensive PostGIS capabilities test"""
    print("🗺️  COMPREHENSIVE POSTGIS CAPABILITIES TEST")
    print("=" * 60)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Database Schema", test_database_initialization),
        ("Test Data Creation", create_test_locations),
        ("Spatial Queries", test_spatial_queries),
        ("Advanced Spatial Functions", test_spatial_functions),
        ("Spatial Analysis Service", test_spatial_analysis_service),
        ("API Endpoints", test_api_endpoints),
        ("Cleanup", cleanup_test_data),
    ]
    
    passed = 0
    total = len(tests)
    failed_tests = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if await test_func():
                passed += 1
            else:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            failed_tests.append(test_name)
    
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL POSTGIS CAPABILITIES WORKING!")
        print("\n🚀 Full GIS features available:")
        print("   ✅ Spatial database with PostGIS")
        print("   ✅ Geometry storage and indexing")
        print("   ✅ Distance and containment queries")
        print("   ✅ Spatial clustering and analysis")
        print("   ✅ H3 hexagonal indexing")
        print("   ✅ Advanced spatial functions")
        print("   ✅ FastAPI spatial endpoints")
        print("\n🌍 Ready for production spatial applications!")
        return True
    else:
        print(f"❌ {len(failed_tests)} tests failed:")
        for test in failed_tests:
            print(f"   - {test}")
        print("\n💡 Check that PostgreSQL with PostGIS is running:")
        print("   docker compose up -d postgres")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)