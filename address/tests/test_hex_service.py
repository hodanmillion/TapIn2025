import pytest
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import h3

from src.services.hex_service import HexagonalLocationService, DEFAULT_RESOLUTION
from src.models.hex_models import HexCell, UserHexLocation, HexLandmark


class TestHexagonalLocationService:
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def hex_service(self, mock_db):
        """Create hex service with mocked database"""
        return HexagonalLocationService(mock_db)
    
    @pytest.fixture
    def sample_coordinates(self):
        """Sample NYC coordinates"""
        return {
            'lat': 40.7589,
            'lng': -73.9851,
            'expected_h3': h3.geo_to_h3(40.7589, -73.9851, DEFAULT_RESOLUTION)
        }
    
    def test_get_hex_for_location(self, hex_service, sample_coordinates):
        """Test converting coordinates to H3 hex index"""
        h3_index = hex_service.get_hex_for_location(
            sample_coordinates['lat'], 
            sample_coordinates['lng']
        )
        
        assert h3_index == sample_coordinates['expected_h3']
        assert len(h3_index) == 15  # H3 index length
        assert h3.h3_is_valid(h3_index)
    
    def test_get_hex_for_location_custom_resolution(self, hex_service, sample_coordinates):
        """Test H3 conversion with custom resolution"""
        for resolution in [6, 7, 8, 9, 10]:
            h3_index = hex_service.get_hex_for_location(
                sample_coordinates['lat'], 
                sample_coordinates['lng'],
                resolution
            )
            
            assert h3.h3_get_resolution(h3_index) == resolution
            assert h3.h3_is_valid(h3_index)
    
    def test_get_or_create_hex_cell_existing(self, hex_service, mock_db, sample_coordinates):
        """Test getting existing hex cell"""
        # Mock existing hex cell
        existing_hex = HexCell(
            h3_index=sample_coordinates['expected_h3'],
            resolution=DEFAULT_RESOLUTION,
            center_lat=sample_coordinates['lat'],
            center_lng=sample_coordinates['lng'],
            display_name="Test Neighborhood"
        )
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing_hex
        
        result = hex_service.get_or_create_hex_cell(
            sample_coordinates['lat'],
            sample_coordinates['lng']
        )
        
        assert result == existing_hex
        assert not mock_db.add.called  # Should not create new
        assert not mock_db.commit.called
    
    def test_get_or_create_hex_cell_new(self, hex_service, mock_db, sample_coordinates):
        """Test creating new hex cell"""
        # Mock no existing hex cell
        mock_db.query.return_value.filter_by.return_value.first.return_value = None
        
        with patch.object(hex_service, '_generate_hex_name', return_value="Test Area"):
            with patch.object(hex_service, '_create_neighbor_relationships'):
                result = hex_service.get_or_create_hex_cell(
                    sample_coordinates['lat'],
                    sample_coordinates['lng']
                )
        
        # Verify new hex cell was created
        assert result.h3_index == sample_coordinates['expected_h3']
        assert result.resolution == DEFAULT_RESOLUTION
        assert result.center_lat == sample_coordinates['lat']
        assert result.center_lng == sample_coordinates['lng']
        assert result.display_name == "Test Area"
        
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    def test_join_hex_chat_new_user(self, hex_service, mock_db, sample_coordinates):
        """Test user joining hex chat for first time"""
        # Mock hex cell
        hex_cell = HexCell(
            h3_index=sample_coordinates['expected_h3'],
            resolution=DEFAULT_RESOLUTION,
            center_lat=sample_coordinates['lat'],
            center_lng=sample_coordinates['lng'],
            display_name="Test Neighborhood",
            active_users=0
        )
        
        with patch.object(hex_service, 'get_or_create_hex_cell', return_value=hex_cell):
            with patch.object(hex_service, '_build_join_response', return_value={"test": "response"}):
                # Mock no existing user location
                mock_db.query.return_value.filter_by.return_value.first.return_value = None
                mock_db.query.return_value.filter_by.return_value.count.return_value = 0
                
                result = hex_service.join_hex_chat(
                    "user123",
                    sample_coordinates['lat'],
                    sample_coordinates['lng']
                )
        
        # Verify user location was created
        mock_db.add.assert_called()
        mock_db.commit.assert_called()
        assert hex_cell.active_users == 1
        assert result == {"test": "response"}
    
    def test_join_hex_chat_existing_user(self, hex_service, mock_db, sample_coordinates):
        """Test existing user rejoining hex chat"""
        # Mock existing user location
        existing_user_location = UserHexLocation(
            user_id="user123",
            h3_index=sample_coordinates['expected_h3'],
            joined_at=datetime.utcnow() - timedelta(hours=1)
        )
        mock_db.query.return_value.filter_by.return_value.first.return_value = existing_user_location
        
        hex_cell = HexCell(
            h3_index=sample_coordinates['expected_h3'],
            resolution=DEFAULT_RESOLUTION,
            center_lat=sample_coordinates['lat'],
            center_lng=sample_coordinates['lng'],
            active_users=5
        )
        
        with patch.object(hex_service, 'get_or_create_hex_cell', return_value=hex_cell):
            with patch.object(hex_service, '_build_join_response', return_value={"test": "response"}):
                result = hex_service.join_hex_chat(
                    "user123",
                    sample_coordinates['lat'],
                    sample_coordinates['lng']
                )
        
        # Verify last_seen was updated
        assert existing_user_location.last_seen is not None
        assert hex_cell.active_users == 5  # Should not increment
        mock_db.commit.assert_called()
    
    def test_get_active_neighbors(self, hex_service, mock_db, sample_coordinates):
        """Test getting active neighboring hex cells"""
        h3_index = sample_coordinates['expected_h3']
        
        # Mock neighbor hex cells
        neighbor_hexes = [
            HexCell(
                h3_index="neighbor1",
                resolution=DEFAULT_RESOLUTION,
                center_lat=40.7600,
                center_lng=-73.9860,
                display_name="North Neighbor",
                active_users=10
            ),
            HexCell(
                h3_index="neighbor2",
                resolution=DEFAULT_RESOLUTION,
                center_lat=40.7580,
                center_lng=-73.9840,
                display_name="South Neighbor",
                active_users=5
            )
        ]
        
        mock_db.query.return_value.filter.return_value.all.return_value = neighbor_hexes
        
        with patch('h3.k_ring', return_value={"neighbor1", "neighbor2", h3_index}):
            with patch('h3.h3_to_geo', side_effect=[
                (40.7589, -73.9851),  # center
                (40.7600, -73.9860),  # neighbor1
                (40.7580, -73.9840)   # neighbor2
            ]):
                with patch('h3.point_dist', side_effect=[0.5, 0.8]):
                    neighbors = hex_service.get_active_neighbors(h3_index)
        
        assert len(neighbors) == 2
        assert neighbors[0].h3_index == "neighbor1"
        assert neighbors[0].name == "North Neighbor"
        assert neighbors[0].active_users == 10
        assert neighbors[0].distance_km == 0.5
        
        # Should be sorted by distance
        assert neighbors[0].distance_km <= neighbors[1].distance_km
    
    def test_get_hex_boundary(self, hex_service, sample_coordinates):
        """Test getting hex boundary coordinates"""
        h3_index = sample_coordinates['expected_h3']
        
        # Mock h3 boundary
        mock_boundary = [
            (40.7595, -73.9845),
            (40.7590, -73.9840),
            (40.7585, -73.9845),
            (40.7585, -73.9857),
            (40.7590, -73.9862),
            (40.7595, -73.9857)
        ]
        
        with patch('h3.h3_to_geo_boundary', return_value=mock_boundary):
            boundary = hex_service.get_hex_boundary(h3_index)
        
        assert len(boundary) == 6  # Hexagon has 6 vertices
        assert boundary[0] == [40.7595, -73.9845]
        assert all(len(point) == 2 for point in boundary)
    
    def test_cleanup_inactive_users(self, hex_service, mock_db):
        """Test cleaning up inactive users"""
        cutoff_time = datetime.utcnow() - timedelta(minutes=30)
        
        # Mock inactive users
        inactive_users = [
            UserHexLocation(user_id="user1", h3_index="hex1", last_seen=cutoff_time - timedelta(minutes=5)),
            UserHexLocation(user_id="user2", h3_index="hex1", last_seen=cutoff_time - timedelta(minutes=10)),
            UserHexLocation(user_id="user3", h3_index="hex2", last_seen=cutoff_time - timedelta(minutes=15))
        ]
        
        # Mock hex cells
        hex_cells = [
            HexCell(h3_index="hex1", active_users=5),
            HexCell(h3_index="hex2", active_users=3)
        ]
        
        mock_db.query.return_value.filter.return_value.all.return_value = inactive_users
        mock_db.query.return_value.filter_by.side_effect = [
            Mock(first=Mock(return_value=hex_cells[0])),
            Mock(first=Mock(return_value=hex_cells[1]))
        ]
        
        hex_service.cleanup_inactive_users(timeout_minutes=30)
        
        # Verify inactive users were deleted
        mock_db.query.return_value.filter.return_value.delete.assert_called_once()
        
        # Verify hex cell user counts were updated
        assert hex_cells[0].active_users == 3  # 5 - 2 inactive users
        assert hex_cells[1].active_users == 2  # 3 - 1 inactive user
        
        mock_db.commit.assert_called_once()
    
    def test_generate_hex_name_with_landmarks(self, hex_service, mock_db):
        """Test generating hex name with landmarks"""
        h3_index = "test_hex"
        
        # Mock landmarks
        landmarks = [
            HexLandmark(name="Central Park", category="landmark"),
            HexLandmark(name="Local Cafe", category="business")
        ]
        mock_db.query.return_value.filter_by.return_value.all.return_value = landmarks
        
        name = hex_service._generate_hex_name(h3_index, 40.7589, -73.9851)
        
        assert name == "Central Park Area"
    
    def test_generate_hex_name_no_landmarks(self, hex_service, mock_db):
        """Test generating hex name without landmarks"""
        h3_index = "test_hex"
        
        # Mock no landmarks
        mock_db.query.return_value.filter_by.return_value.all.return_value = []
        
        with patch('h3.h3_get_resolution', return_value=8):
            name = hex_service._generate_hex_name(h3_index, 40.7589, -73.9851)
        
        assert name == "Neighborhood Chat"
    
    def test_get_direction(self, hex_service):
        """Test getting direction between two points"""
        # North
        direction = hex_service._get_direction((40.7589, -73.9851), (40.7600, -73.9851))
        assert direction == "north"
        
        # South
        direction = hex_service._get_direction((40.7589, -73.9851), (40.7580, -73.9851))
        assert direction == "south"
        
        # East
        direction = hex_service._get_direction((40.7589, -73.9851), (40.7589, -73.9840))
        assert direction == "east"
        
        # West
        direction = hex_service._get_direction((40.7589, -73.9851), (40.7589, -73.9860))
        assert direction == "west"
    
    def test_build_join_response(self, hex_service):
        """Test building join response"""
        hex_cell = HexCell(
            h3_index="test_hex",
            resolution=8,
            center_lat=40.7589,
            center_lng=-73.9851,
            display_name="Test Area",
            locality="Manhattan",
            active_users=5
        )
        
        with patch.object(hex_service, 'get_hex_boundary', return_value=[[40.759, -73.985]]):
            with patch.object(hex_service, 'get_active_neighbors', return_value=[]):
                response = hex_service._build_join_response(hex_cell, 40.7589, -73.9851)
        
        assert response['hex_cell']['h3_index'] == "test_hex"
        assert response['hex_cell']['resolution'] == 8
        assert response['hex_cell']['center']['lat'] == 40.7589
        assert response['hex_cell']['center']['lng'] == -73.9851
        assert response['hex_cell']['display_name'] == "Test Area"
        assert response['hex_cell']['active_users'] == 5
        assert response['neighbors'] == []
        assert response['your_position'] == {"lat": 40.7589, "lng": -73.9851}


@pytest.fixture
def sample_hex_data():
    """Sample hex data for testing"""
    return {
        'h3_index': '882a1072cffffff',
        'resolution': 8,
        'center_lat': 40.7589,
        'center_lng': -73.9851,
        'display_name': 'Times Square Area'
    }


class TestHexModels:
    
    def test_hex_cell_creation(self, sample_hex_data):
        """Test creating HexCell model"""
        hex_cell = HexCell(**sample_hex_data)
        
        assert hex_cell.h3_index == sample_hex_data['h3_index']
        assert hex_cell.resolution == sample_hex_data['resolution']
        assert hex_cell.center_lat == sample_hex_data['center_lat']
        assert hex_cell.center_lng == sample_hex_data['center_lng']
        assert hex_cell.display_name == sample_hex_data['display_name']
        assert hex_cell.active_users == 0  # Default value
    
    def test_user_hex_location_creation(self, sample_hex_data):
        """Test creating UserHexLocation model"""
        user_location = UserHexLocation(
            user_id="user123",
            h3_index=sample_hex_data['h3_index']
        )
        
        assert user_location.user_id == "user123"
        assert user_location.h3_index == sample_hex_data['h3_index']
        assert user_location.joined_at is not None
        assert user_location.last_seen is not None
    
    def test_hex_landmark_creation(self, sample_hex_data):
        """Test creating HexLandmark model"""
        landmark = HexLandmark(
            h3_index=sample_hex_data['h3_index'],
            name="Central Park",
            category="park",
            lat=40.7589,
            lng=-73.9851
        )
        
        assert landmark.h3_index == sample_hex_data['h3_index']
        assert landmark.name == "Central Park"
        assert landmark.category == "park"
        assert landmark.lat == 40.7589
        assert landmark.lng == -73.9851


if __name__ == "__main__":
    pytest.main([__file__, "-v"])