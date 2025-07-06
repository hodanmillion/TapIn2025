"""
Configuration for E2E tests
"""
import os
from typing import Dict, Any

# Test configuration
TEST_CONFIG = {
    "base_url": os.getenv("TEST_BASE_URL", "http://localhost:8000"),
    "timeout": int(os.getenv("TEST_TIMEOUT", "30")),
    "max_retries": int(os.getenv("TEST_MAX_RETRIES", "30")),
    "retry_delay": float(os.getenv("TEST_RETRY_DELAY", "1.0")),
    "batch_size": int(os.getenv("TEST_BATCH_SIZE", "10")),
    "concurrent_requests": int(os.getenv("TEST_CONCURRENT_REQUESTS", "10")),
    "cleanup_test_data": os.getenv("TEST_CLEANUP", "true").lower() == "true",
}

# Test data for NYC locations
NYC_TEST_LOCATIONS = [
    {
        "name": "Empire State Building",
        "address": "Empire State Building, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7484,
        "lon": -73.9857,
        "category": "landmark"
    },
    {
        "name": "Central Park",
        "address": "Central Park, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7829,
        "lon": -73.9654,
        "category": "park"
    },
    {
        "name": "Brooklyn Bridge",
        "address": "Brooklyn Bridge, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7061,
        "lon": -73.9969,
        "category": "bridge"
    },
    {
        "name": "Times Square",
        "address": "Times Square, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7580,
        "lon": -73.9855,
        "category": "plaza"
    },
    {
        "name": "Statue of Liberty",
        "address": "Statue of Liberty, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.6892,
        "lon": -74.0445,
        "category": "monument"
    },
    {
        "name": "Wall Street",
        "address": "Wall Street, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7074,
        "lon": -74.0113,
        "category": "street"
    },
    {
        "name": "High Line",
        "address": "High Line, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7480,
        "lon": -74.0048,
        "category": "park"
    },
    {
        "name": "9/11 Memorial",
        "address": "9/11 Memorial, New York, NY",
        "expected_city": "New York",
        "expected_state": "NY",
        "lat": 40.7115,
        "lon": -74.0134,
        "category": "memorial"
    }
]

# Test polygons for spatial testing
TEST_POLYGONS = {
    "manhattan": [
        [-74.0479, 40.6892],  # Bottom left
        [-73.9441, 40.6892],  # Bottom right
        [-73.9441, 40.8176],  # Top right
        [-74.0479, 40.8176],  # Top left
        [-74.0479, 40.6892]   # Close polygon
    ],
    "central_park": [
        [-73.9812, 40.7681],  # SW corner
        [-73.9481, 40.7681],  # SE corner
        [-73.9481, 40.7967],  # NE corner
        [-73.9812, 40.7967],  # NW corner
        [-73.9812, 40.7681]   # Close polygon
    ],
    "financial_district": [
        [-74.0200, 40.7000],  # SW corner
        [-74.0050, 40.7000],  # SE corner
        [-74.0050, 40.7150],  # NE corner
        [-74.0200, 40.7150],  # NW corner
        [-74.0200, 40.7000]   # Close polygon
    ]
}

# Test bounding boxes
TEST_BOUNDING_BOXES = {
    "manhattan": {
        "min_lat": 40.6892,
        "min_lon": -74.0479,
        "max_lat": 40.8176,
        "max_lon": -73.9441
    },
    "nyc_metro": {
        "min_lat": 40.4774,
        "min_lon": -74.2591,
        "max_lat": 40.9176,
        "max_lon": -73.7004
    },
    "tri_state": {
        "min_lat": 40.0000,
        "min_lon": -75.0000,
        "max_lat": 41.5000,
        "max_lon": -73.0000
    }
}

# Expected API endpoints
EXPECTED_ENDPOINTS = {
    "health": [
        "/health/",
        "/health/ready",
        "/metrics"
    ],
    "address": [
        "/api/v1/addresses/search",
        "/api/v1/addresses/detail",
        "/api/v1/addresses/nearby",
        "/api/v1/addresses/batch"
    ],
    "spatial": [
        "/api/v1/spatial/analyze",
        "/api/v1/spatial/search/polygon",
        "/api/v1/spatial/heatmap",
        "/api/v1/spatial/nearest"
    ],
    "docs": [
        "/docs",
        "/openapi.json"
    ]
}

# Performance test parameters
PERFORMANCE_TEST_PARAMS = {
    "concurrent_requests": 10,
    "request_timeout": 5.0,
    "max_response_time": 2.0,  # seconds
    "min_throughput": 5.0,     # requests per second
}

# Spatial analysis test parameters
SPATIAL_TEST_PARAMS = {
    "clustering": {
        "eps_meters": 1000,
        "min_samples": 2
    },
    "heatmap": {
        "resolution": 9,
        "min_zoom": 8,
        "max_zoom": 12
    },
    "nearest_neighbors": {
        "k": 5,
        "max_k": 20
    },
    "search_radius": {
        "small": 500,      # meters
        "medium": 2000,    # meters
        "large": 10000     # meters
    }
}

# Error test cases
ERROR_TEST_CASES = [
    {
        "name": "Invalid coordinates - latitude too high",
        "endpoint": "/api/v1/addresses/nearby",
        "payload": {
            "coordinates": {"latitude": 91, "longitude": -73.9857},
            "radius_meters": 1000
        },
        "expected_status": 422
    },
    {
        "name": "Invalid coordinates - longitude too low",
        "endpoint": "/api/v1/addresses/nearby", 
        "payload": {
            "coordinates": {"latitude": 40.7484, "longitude": -181},
            "radius_meters": 1000
        },
        "expected_status": 422
    },
    {
        "name": "Empty search query",
        "endpoint": "/api/v1/addresses/search",
        "payload": {"query": "", "limit": 5},
        "expected_status": 422
    },
    {
        "name": "Negative radius",
        "endpoint": "/api/v1/addresses/nearby",
        "payload": {
            "coordinates": {"latitude": 40.7484, "longitude": -73.9857},
            "radius_meters": -1000
        },
        "expected_status": 422
    },
    {
        "name": "Invalid place_id",
        "endpoint": "/api/v1/addresses/detail",
        "payload": {"place_id": "invalid_place_id_12345"},
        "expected_status": 404
    }
]

def get_test_config() -> Dict[str, Any]:
    """Get test configuration"""
    return TEST_CONFIG

def get_test_locations() -> List[Dict[str, Any]]:
    """Get test location data"""
    return NYC_TEST_LOCATIONS

def get_test_polygons() -> Dict[str, List[List[float]]]:
    """Get test polygon data"""
    return TEST_POLYGONS

def get_test_bounding_boxes() -> Dict[str, Dict[str, float]]:
    """Get test bounding box data"""
    return TEST_BOUNDING_BOXES