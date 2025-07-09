import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import h3

from src.main import app
from src.models.hex_models import HexCell, UserHexLocation


class TestHexAPI:
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_current_user(self):
        """Mock authenticated user"""
        return Mock(id="user123", username="testuser")
    
    @pytest.fixture
    def sample_coords(self):
        """Sample coordinates"""
        return {"lat": 40.7589, "lng": -73.9851}
    
    def test_join_hex_chat_success(self, client, mock_current_user, sample_coords):
        """Test successful hex chat join"""
        with patch('src.api.hex_routes.get_current_user', return_value=mock_current_user):
            with patch('src.api.hex_routes.get_db'):
                with patch('src.services.hex_service.HexagonalLocationService') as mock_service:
                    # Mock service response
                    mock_service.return_value.join_hex_chat.return_value = {
                        "hex_cell": {
                            "h3_index": "882a1072cffffff",
                            "resolution": 8,
                            "center": {"lat": 40.7589, "lng": -73.9851},
                            "display_name": "Test Area",
                            "active_users": 1,
                            "boundary": [[40.759, -73.985]]
                        },
                        "neighbors": [],
                        "your_position": {"lat": 40.7589, "lng": -73.9851}
                    }
                    
                    response = client.post(
                        "/api/v1/hex/join",
                        params={"lat": sample_coords["lat"], "lng": sample_coords["lng"]}
                    )
        
        assert response.status_code == 200
        data = response.json()
        assert data["hex_cell"]["h3_index"] == "882a1072cffffff"
        assert data["hex_cell"]["resolution"] == 8
        assert data["hex_cell"]["active_users"] == 1
    
    def test_join_hex_chat_invalid_resolution(self, client, mock_current_user, sample_coords):
        """Test join with invalid resolution"""
        with patch('src.api.hex_routes.get_current_user', return_value=mock_current_user):
            response = client.post(
                "/api/v1/hex/join",
                params={"lat": sample_coords["lat"], "lng": sample_coords["lng"], "resolution": 15}
            )
        
        assert response.status_code == 400
        assert "Resolution must be between 6 and 10" in response.json()["detail"]
    
    def test_get_hex_cell_info_success(self, client):
        """Test getting hex cell info"""
        h3_index = "882a1072cffffff"
        
        with patch('src.api.hex_routes.get_db'):
            with patch('src.models.hex_models.HexCell') as mock_hex_cell:
                mock_hex = Mock()
                mock_hex.h3_index = h3_index
                mock_hex.resolution = 8
                mock_hex.center_lat = 40.7589
                mock_hex.center_lng = -73.9851
                mock_hex.display_name = "Test Area"
                mock_hex.active_users = 5
                
                mock_query = Mock()
                mock_query.filter_by.return_value.first.return_value = mock_hex
                
                with patch('src.api.hex_routes.db.query', return_value=mock_query):
                    with patch('src.services.hex_service.HexagonalLocationService') as mock_service:
                        mock_service.return_value.get_hex_boundary.return_value = [[40.759, -73.985]]
                        
                        response = client.get(f"/api/v1/hex/cell/{h3_index}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["h3_index"] == h3_index
        assert data["resolution"] == 8
        assert data["active_users"] == 5
    
    def test_get_hex_cell_info_not_found(self, client):
        """Test getting non-existent hex cell"""
        h3_index = "nonexistent"
        
        with patch('src.api.hex_routes.get_db'):
            with patch('src.models.hex_models.HexCell') as mock_hex_cell:
                mock_query = Mock()
                mock_query.filter_by.return_value.first.return_value = None
                
                with patch('src.api.hex_routes.db.query', return_value=mock_query):
                    response = client.get(f"/api/v1/hex/cell/{h3_index}")
        
        assert response.status_code == 404
        assert "Hex cell not found" in response.json()["detail"]
    
    def test_get_active_neighbors_success(self, client):
        """Test getting active neighbors"""
        h3_index = "882a1072cffffff"
        
        with patch('src.api.hex_routes.get_db'):
            with patch('src.services.hex_service.HexagonalLocationService') as mock_service:
                mock_service.return_value.get_active_neighbors.return_value = [
                    Mock(
                        h3_index="neighbor1",
                        name="North Area",
                        active_users=10,
                        distance_km=0.5,
                        direction="north"
                    )
                ]
                
                response = client.get(f"/api/v1/hex/neighbors/{h3_index}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["neighbors"]) == 1
        assert data["neighbors"][0]["h3_index"] == "neighbor1"
        assert data["neighbors"][0]["name"] == "North Area"
        assert data["neighbors"][0]["active_users"] == 10
    
    def test_get_available_resolutions(self, client):
        """Test getting available resolutions"""
        response = client.get("/api/v1/hex/resolutions")
        
        assert response.status_code == 200
        data = response.json()
        assert "resolutions" in data
        assert "default" in data
        assert data["default"] == 8
        
        resolutions = data["resolutions"]
        assert len(resolutions) == 5
        
        # Check specific resolution
        neighborhood = next(r for r in resolutions if r["level"] == 8)
        assert neighborhood["name"] == "Neighborhood"
        assert neighborhood["description"] == "Standard neighborhood chat (default)"
    
    def test_cleanup_inactive_users_success(self, client, mock_current_user):
        """Test cleaning up inactive users"""
        with patch('src.api.hex_routes.get_current_user', return_value=mock_current_user):
            with patch('src.api.hex_routes.get_db'):
                with patch('src.services.hex_service.HexagonalLocationService') as mock_service:
                    mock_service.return_value.cleanup_inactive_users.return_value = None
                    
                    response = client.post("/api/v1/hex/cleanup")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cleanup completed"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])