#!/usr/bin/env python3
"""
Test script for the Address Service with PostGIS
"""

def test_imports():
    """Test all critical imports"""
    print("🧪 Testing imports...")
    
    try:
        import src.main
        import src.models
        import src.database
        import src.services.address_service
        import src.services.geocoding
        import src.services.spatial_service
        print("✅ All imports successful")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def test_models():
    """Test Pydantic models"""
    print("🧪 Testing Pydantic models...")
    
    try:
        from src.models import Coordinates, AddressSearchRequest, LocationResponse
        from shapely.geometry import Point
        import uuid
        from datetime import datetime
        
        # Test coordinates
        coords = Coordinates(latitude=40.7128, longitude=-74.0060)
        point = coords.to_shapely_point()
        assert isinstance(point, Point)
        
        # Test search request
        search = AddressSearchRequest(query="Empire State Building", limit=5)
        assert search.query == "Empire State Building"
        assert search.limit == 5
        
        print("✅ Pydantic models working")
        return True
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False

def test_spatial_service():
    """Test spatial analysis service"""
    print("🧪 Testing spatial analysis...")
    
    try:
        from src.services.spatial_service import SpatialAnalysisService
        
        spatial = SpatialAnalysisService()
        
        # Test H3 indexing
        h3_index = spatial.calculate_h3_indices(40.7128, -74.0060, resolution=9)
        assert isinstance(h3_index, str)
        assert len(h3_index) > 0
        
        # Test coordinate system setup
        assert spatial.wgs84 == "EPSG:4326"
        assert spatial.web_mercator == "EPSG:3857"
        
        print("✅ Spatial analysis service working")
        return True
    except Exception as e:
        print(f"❌ Spatial service test failed: {e}")
        return False

def test_geocoding_service():
    """Test geocoding service"""
    print("🧪 Testing geocoding service...")
    
    try:
        from src.services.geocoding import get_geocoding_provider, NominatimProvider
        
        geocoder = get_geocoding_provider()
        assert geocoder is not None
        
        # Should default to Nominatim since no Google API key
        assert isinstance(geocoder, NominatimProvider)
        
        print("✅ Geocoding service working")
        return True
    except Exception as e:
        print(f"❌ Geocoding service test failed: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI application"""
    print("🧪 Testing FastAPI application...")
    
    try:
        from src.main import app
        
        # Check app configuration
        assert app.title == "Address Service with Spatial Analysis"
        assert app.version == "2.0.0"
        
        # Check routes are configured
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        api_routes = [r for r in routes if r.startswith('/api')]
        assert len(api_routes) > 0
        
        expected_routes = [
            '/api/v1/addresses/search',
            '/api/v1/addresses/detail', 
            '/api/v1/addresses/nearby',
            '/api/v1/spatial/analyze'
        ]
        
        for expected in expected_routes:
            assert expected in routes, f"Route {expected} not found"
        
        print("✅ FastAPI application configured correctly")
        return True
    except Exception as e:
        print(f"❌ FastAPI test failed: {e}")
        return False

def test_database_model():
    """Test database model structure"""
    print("🧪 Testing database model...")
    
    try:
        from src.database import Location, Base
        from geoalchemy2 import Geometry
        
        # Check that Location model has required columns
        assert hasattr(Location, 'id')
        assert hasattr(Location, 'coordinates')
        assert hasattr(Location, 'place_id')
        
        # Check geometry column type
        coord_col = Location.__table__.columns['coordinates']
        assert isinstance(coord_col.type, Geometry)
        assert coord_col.type.geometry_type == 'POINT'
        assert coord_col.type.srid == 4326
        
        print("✅ Database model structure correct")
        return True
    except Exception as e:
        print(f"❌ Database model test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Address Service Test Suite")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_models, 
        test_spatial_service,
        test_geocoding_service,
        test_database_model,
        test_fastapi_app,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! Address service is ready.")
        print("\n🏃 To run the service:")
        print("   python run.py")
        print("\n📚 API docs will be at:")
        print("   http://localhost:8000/docs")
        return True
    else:
        print("❌ Some tests failed. Check the errors above.")
        return False

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)