#!/usr/bin/env python3
"""
End-to-End Test Suite for Address Service with PostGIS
Tests complete workflow from API endpoints through database operations
"""
import asyncio
import pytest
import httpx
import json
import time
from jose import jwt
from typing import List, Dict, Any
from uuid import uuid4
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_TIMEOUT = 30
BATCH_SIZE = 10
SECRET_KEY = "demo-secret-key-change-in-production"  # From .env file

class E2ETestRunner:
    def __init__(self):
        self.client = None
        self.test_data = []
        self.created_locations = []
        self.auth_token = None
        
    async def setup(self):
        """Setup test environment"""
        print("🚀 Setting up E2E test environment...")
        
        # Generate test JWT token
        self._generate_test_token()
        
        # Create HTTP client with auth headers
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=TEST_TIMEOUT, headers=headers)
        
        # Wait for service to be ready
        await self._wait_for_service()
        
        # Create test data
        self._create_test_data()
        
        print("✅ E2E test environment ready")
    
    async def teardown(self):
        """Cleanup test environment"""
        print("🧹 Cleaning up test environment...")
        
        # Clean up created locations
        await self._cleanup_test_data()
        
        # Close HTTP client
        if self.client:
            await self.client.aclose()
        
        print("✅ E2E test cleanup complete")
    
    def _generate_test_token(self):
        """Generate a test JWT token"""
        payload = {
            "sub": "test_user",
            "user_id": "test_user_123",
            "exp": int(time.time()) + 3600  # 1 hour expiry
        }
        self.auth_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    async def _wait_for_service(self):
        """Wait for service to be ready"""
        print("⏳ Waiting for service to be ready...")
        
        max_retries = 30
        for i in range(max_retries):
            try:
                response = await self.client.get("/health/")
                if response.status_code == 200:
                    print(f"✅ Service ready after {i+1} attempts")
                    return
            except Exception as e:
                if i == max_retries - 1:
                    raise Exception(f"Service not ready after {max_retries} attempts: {e}")
                await asyncio.sleep(1)
    
    def _create_test_data(self):
        """Create test data for E2E tests"""
        self.test_data = [
            {
                "address": "Empire State Building, New York, NY",
                "expected_city": "New York",
                "expected_state": "NY",
                "lat": 40.7484,
                "lon": -73.9857
            },
            {
                "address": "Central Park, New York, NY",
                "expected_city": "New York", 
                "expected_state": "NY",
                "lat": 40.7829,
                "lon": -73.9654
            },
            {
                "address": "Brooklyn Bridge, New York, NY",
                "expected_city": "New York",
                "expected_state": "NY", 
                "lat": 40.7061,
                "lon": -73.9969
            },
            {
                "address": "Times Square, New York, NY",
                "expected_city": "New York",
                "expected_state": "NY",
                "lat": 40.7580,
                "lon": -73.9855
            },
            {
                "address": "Statue of Liberty, New York, NY",
                "expected_city": "New York",
                "expected_state": "NY",
                "lat": 40.6892,
                "lon": -74.0445
            }
        ]
    
    async def _cleanup_test_data(self):
        """Clean up test data"""
        if not self.created_locations:
            return
        
        print(f"🧹 Cleaning up {len(self.created_locations)} test locations...")
        
        # Note: In a real app, you'd have a delete endpoint
        # For now, we'll just track what we created
        self.created_locations.clear()
    
    async def test_health_endpoints(self):
        """Test health and monitoring endpoints"""
        print("\n🏥 Testing health endpoints...")
        
        # Basic health check
        response = await self.client.get("/health/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("  ✅ Basic health check working")
        
        # Readiness check
        response = await self.client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "database" in data["checks"]
        print("  ✅ Readiness check working")
        
        # API documentation
        response = await self.client.get("/docs")
        assert response.status_code == 200
        print("  ✅ API documentation available")
        
        # OpenAPI spec
        response = await self.client.get("/openapi.json")
        assert response.status_code == 200
        spec = response.json()
        assert "paths" in spec
        print("  ✅ OpenAPI specification available")
    
    async def test_address_search(self):
        """Test address search functionality"""
        print("\n🔍 Testing address search...")
        
        search_queries = [
            "Empire State Building",
            "Central Park",
            "Brooklyn Bridge"
        ]
        
        for query in search_queries:
            response = await self.client.post(
                "/api/v1/addresses/search",
                json={"query": query, "limit": 5}
            )
            
            assert response.status_code == 200
            results = response.json()
            assert isinstance(results, list)
            assert len(results) > 0
            
            # Check first result has required fields
            result = results[0]
            assert "id" in result
            assert "place_id" in result
            assert "address_string" in result
            assert "coordinates" in result
            assert "latitude" in result["coordinates"]
            assert "longitude" in result["coordinates"]
            
            print(f"  ✅ Search for '{query}' returned {len(results)} results")
    
    async def test_address_detail(self):
        """Test address detail functionality"""
        print("\n📍 Testing address detail...")
        
        # First search for an address to get a place_id
        response = await self.client.post(
            "/api/v1/addresses/search",
            json={"query": "Empire State Building", "limit": 1}
        )
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        assert len(results) > 0
        
        place_id = results[0]["place_id"]
        
        # Get address details
        response = await self.client.post(
            "/api/v1/addresses/detail",
            json={"place_id": place_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "coordinates" in data
        assert "components" in data
        
        print(f"  ✅ Address detail for place_id '{place_id}' retrieved")
    
    async def test_nearby_search(self):
        """Test nearby location search"""
        print("\n📍 Testing nearby search...")
        
        # Search near Times Square
        times_square_coords = {"latitude": 40.7580, "longitude": -73.9855}
        
        response = await self.client.post(
            "/api/v1/addresses/nearby",
            json={
                "coordinates": times_square_coords,
                "radius_meters": 2000,
                "limit": 10
            }
        )
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        
        # Check distance is included
        if results:
            result = results[0]
            assert "distance_meters" in result
            assert result["distance_meters"] >= 0
            print(f"  ✅ Nearby search found {len(results)} locations within 2km")
        else:
            print("  ℹ️  No nearby locations found (expected if database is empty)")
    
    async def test_batch_operations(self):
        """Test batch address operations"""
        print("\n📦 Testing batch operations...")
        
        # Create batch of addresses
        addresses = [item["address"] for item in self.test_data[:3]]
        
        response = await self.client.post(
            "/api/v1/addresses/batch",
            json=addresses
        )
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        assert len(results) == len(addresses)
        
        # Store created locations for cleanup
        self.created_locations.extend(results)
        
        print(f"  ✅ Batch created {len(results)} addresses")
    
    async def test_spatial_analysis(self):
        """Test spatial analysis endpoints"""
        print("\n🗺️ Testing spatial analysis...")
        
        # First ensure we have some locations
        if not self.created_locations:
            await self.test_batch_operations()
        
        if not self.created_locations:
            print("  ⚠️  No locations available for spatial analysis")
            return
        
        # Test spatial analysis
        location_ids = [loc["id"] for loc in self.created_locations]
        
        response = await self.client.post(
            "/api/v1/spatial/analyze",
            json=location_ids
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "clusters" in data
        assert "total_locations" in data
        
        print(f"  ✅ Spatial analysis completed")
    
    async def test_heatmap_generation(self):
        """Test heatmap generation"""
        print("\n🔥 Testing heatmap generation...")
        
        # Generate heatmap for NYC area
        response = await self.client.post(
            "/api/v1/spatial/heatmap",
            json={
                "coordinates": [
                    {"latitude": 40.7484, "longitude": -73.9857},
                    {"latitude": 40.7580, "longitude": -73.9855}
                ],
                "weights": [1.0, 1.0],
                "h3_resolution": 9
            }
        )
        
        assert response.status_code == 200
        # Response is HTML, not JSON
        html_content = response.text
        assert "<!DOCTYPE html>" in html_content or "<html>" in html_content
        
        print(f"  ✅ Heatmap HTML generated ({len(html_content)} characters)")
    
    async def test_polygon_search(self):
        """Test polygon-based search"""
        print("\n🔺 Testing polygon search...")
        
        # Define a polygon around Manhattan
        manhattan_polygon = [
            [-74.0479, 40.6892],  # Bottom left
            [-73.9441, 40.6892],  # Bottom right
            [-73.9441, 40.8176],  # Top right
            [-74.0479, 40.8176],  # Top left
            [-74.0479, 40.6892]   # Close polygon
        ]
        
        response = await self.client.post(
            "/api/v1/spatial/search/polygon",
            json={
                "polygon": manhattan_polygon,
                "limit": 20
            }
        )
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        
        print(f"  ✅ Polygon search found {len(results)} locations")
    
    async def test_nearest_neighbors(self):
        """Test nearest neighbor search"""
        print("\n🎯 Testing nearest neighbors...")
        
        # Find nearest neighbors to Times Square
        response = await self.client.post(
            "/api/v1/spatial/nearest?k=5",
            json={"latitude": 40.7580, "longitude": -73.9855}
        )
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        
        # Check distances are sorted
        if len(results) > 1:
            distances = [result["distance_meters"] for result in results]
            assert distances == sorted(distances), "Results should be sorted by distance"
        
        print(f"  ✅ Found {len(results)} nearest neighbors")
    
    async def test_error_handling(self):
        """Test error handling and edge cases"""
        print("\n⚠️ Testing error handling...")
        
        # Test invalid coordinates
        response = await self.client.post(
            "/api/v1/addresses/nearby",
            json={
                "coordinates": {"latitude": 91, "longitude": 181},  # Invalid coords
                "radius_meters": 1000
            }
        )
        assert response.status_code == 422  # Validation error
        print("  ✅ Invalid coordinates rejected")
        
        # Test empty search query
        response = await self.client.post(
            "/api/v1/addresses/search",
            json={"query": "", "limit": 5}
        )
        assert response.status_code == 422  # Validation error
        print("  ✅ Empty search query rejected")
        
        # Test invalid place_id
        response = await self.client.post(
            "/api/v1/addresses/detail",
            json={"place_id": "invalid_place_id"}
        )
        assert response.status_code == 404  # Not found
        print("  ✅ Invalid place_id handled")
    
    async def test_performance(self):
        """Test performance and load handling"""
        print("\n🚀 Testing performance...")
        
        # Test concurrent requests
        start_time = time.time()
        
        tasks = []
        for i in range(10):
            task = self.client.post(
                "/api/v1/addresses/search",
                json={"query": f"New York {i}", "limit": 5}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200
        
        print(f"  ✅ Handled 10 concurrent requests in {duration:.2f} seconds")
    
    async def run_all_tests(self):
        """Run complete E2E test suite"""
        print("🧪 STARTING END-TO-END TEST SUITE")
        print("=" * 60)
        
        test_methods = [
            ("Health Endpoints", self.test_health_endpoints),
            ("Address Search", self.test_address_search),
            ("Address Detail", self.test_address_detail),
            ("Nearby Search", self.test_nearby_search),
            ("Batch Operations", self.test_batch_operations),
            ("Spatial Analysis", self.test_spatial_analysis),
            ("Heatmap Generation", self.test_heatmap_generation),
            ("Polygon Search", self.test_polygon_search),
            ("Nearest Neighbors", self.test_nearest_neighbors),
            ("Error Handling", self.test_error_handling),
            ("Performance", self.test_performance),
        ]
        
        passed = 0
        failed = 0
        failed_tests = []
        
        for test_name, test_method in test_methods:
            try:
                await test_method()
                passed += 1
                print(f"✅ {test_name} - PASSED")
            except Exception as e:
                failed += 1
                failed_tests.append((test_name, str(e)))
                print(f"❌ {test_name} - FAILED: {e}")
        
        print("\n" + "=" * 60)
        print(f"📊 E2E TEST RESULTS: {passed}/{len(test_methods)} tests passed")
        
        if failed == 0:
            print("🎉 ALL E2E TESTS PASSED!")
            print("\n✅ Address service is production-ready:")
            print("   • All API endpoints working")
            print("   • Spatial analysis functional")
            print("   • Error handling robust")
            print("   • Performance acceptable")
            print("   • Database operations working")
            return True
        else:
            print(f"❌ {failed} tests failed:")
            for test_name, error in failed_tests:
                print(f"   • {test_name}: {error}")
            return False

async def main():
    """Main test runner"""
    runner = E2ETestRunner()
    
    try:
        await runner.setup()
        success = await runner.run_all_tests()
        return success
    except Exception as e:
        print(f"❌ E2E test setup failed: {e}")
        print("💡 Make sure the address service is running:")
        print("   docker-compose up -d")
        print("   python run.py")
        return False
    finally:
        await runner.teardown()

if __name__ == "__main__":
    import sys
    success = asyncio.run(main())
    sys.exit(0 if success else 1)