import h3
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from ..hex_models import HexCell, UserHexLocation, HexLandmark, HexCellResponse, NeighborhoodInfo
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Default resolution for neighborhood chats
DEFAULT_RESOLUTION = 8  # ~0.7km hexagons

class HexagonalLocationService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_hex_for_location(self, lat: float, lng: float, resolution: int = DEFAULT_RESOLUTION) -> str:
        """Convert coordinates to H3 hex index"""
        return h3.latlng_to_cell(lat, lng, resolution)
    
    def get_or_create_hex_cell(self, lat: float, lng: float, resolution: int = DEFAULT_RESOLUTION) -> HexCell:
        """Get or create a hex cell for the given coordinates"""
        h3_index = self.get_hex_for_location(lat, lng, resolution)
        
        # Check if hex exists
        hex_cell = self.db.query(HexCell).filter_by(h3_index=h3_index).first()
        
        if not hex_cell:
            # Create new hex cell
            center = h3.cell_to_latlng(h3_index)
            hex_cell = HexCell(
                h3_index=h3_index,
                resolution=resolution,
                center_lat=center[0],
                center_lng=center[1]
            )
            
            # Try to determine neighborhood name
            hex_cell.display_name = self._generate_hex_name(h3_index, lat, lng)
            
            self.db.add(hex_cell)
            self.db.commit()
            
            # Pre-compute neighbors
            self._create_neighbor_relationships(h3_index)
        
        return hex_cell
    
    def join_hex_chat(self, user_id: str, lat: float, lng: float, resolution: int = DEFAULT_RESOLUTION) -> dict:
        """User joins their neighborhood hex chat"""
        # Get or create hex cell
        hex_cell = self.get_or_create_hex_cell(lat, lng, resolution)
        
        # Update user location
        user_location = self.db.query(UserHexLocation).filter_by(
            user_id=user_id,
            h3_index=hex_cell.h3_index
        ).first()
        
        if not user_location:
            user_location = UserHexLocation(
                user_id=user_id,
                h3_index=hex_cell.h3_index
            )
            self.db.add(user_location)
            
            # Increment active users
            hex_cell.active_users = self.db.query(UserHexLocation).filter_by(
                h3_index=hex_cell.h3_index
            ).count() + 1
        else:
            user_location.last_seen = datetime.utcnow()
        
        # Update hex activity
        hex_cell.last_activity = datetime.utcnow()
        self.db.commit()
        
        # Get hex info with neighbors
        return self._build_join_response(hex_cell, lat, lng)
    
    def get_active_neighbors(self, h3_index: str, rings: int = 1) -> List[NeighborhoodInfo]:
        """Get active neighboring hex cells"""
        # Get neighbor indices
        neighbors = set(h3.grid_disk(h3_index, rings)) - {h3_index}
        
        # Query active neighbors
        active_hexes = self.db.query(HexCell).filter(
            and_(
                HexCell.h3_index.in_(neighbors),
                HexCell.active_users > 0
            )
        ).all()
        
        # Build neighbor info
        center = h3.cell_to_latlng(h3_index)
        neighbor_info = []
        
        for hex_cell in active_hexes:
            neighbor_center = h3.cell_to_latlng(hex_cell.h3_index)
            distance = h3.great_circle_distance(center, neighbor_center, unit='km')
            direction = self._get_direction(center, neighbor_center)
            
            neighbor_info.append(NeighborhoodInfo(
                h3_index=hex_cell.h3_index,
                name=hex_cell.display_name or f"Hex {hex_cell.h3_index[:8]}",
                active_users=hex_cell.active_users,
                distance_km=round(distance, 1),
                direction=direction
            ))
        
        return sorted(neighbor_info, key=lambda x: x.distance_km)
    
    def get_hex_boundary(self, h3_index: str) -> List[List[float]]:
        """Get the boundary coordinates of a hex cell"""
        boundary = h3.cell_to_boundary(h3_index)
        return [[lat, lng] for lat, lng in boundary]
    
    def cleanup_inactive_users(self, timeout_minutes: int = 30):
        """Remove users who haven't been seen recently"""
        cutoff = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        # Find inactive users
        inactive = self.db.query(UserHexLocation).filter(
            UserHexLocation.last_seen < cutoff
        ).all()
        
        # Update hex cell counts
        hex_updates = {}
        for user_loc in inactive:
            if user_loc.h3_index not in hex_updates:
                hex_updates[user_loc.h3_index] = 0
            hex_updates[user_loc.h3_index] += 1
        
        # Delete inactive users
        self.db.query(UserHexLocation).filter(
            UserHexLocation.last_seen < cutoff
        ).delete()
        
        # Update hex active user counts
        for h3_index, count in hex_updates.items():
            hex_cell = self.db.query(HexCell).filter_by(h3_index=h3_index).first()
            if hex_cell:
                hex_cell.active_users = max(0, hex_cell.active_users - count)
        
        self.db.commit()
    
    def _generate_hex_name(self, h3_index: str, lat: float, lng: float) -> str:
        """Generate a friendly name for the hex cell"""
        # Check for nearby landmarks
        landmarks = self.db.query(HexLandmark).filter_by(h3_index=h3_index).all()
        
        if landmarks:
            # Use most prominent landmark
            return f"{landmarks[0].name} Area"
        
        # Use resolution-based generic names
        resolution = h3.get_resolution(h3_index)
        if resolution <= 7:
            return "District Chat"
        elif resolution == 8:
            return "Neighborhood Chat"
        elif resolution >= 9:
            return "Local Chat"
        
        return f"Area {h3_index[:6]}"
    
    def _create_neighbor_relationships(self, h3_index: str):
        """Pre-compute and store neighbor relationships"""
        neighbors = set(h3.grid_disk(h3_index, 1)) - {h3_index}
        center = h3.cell_to_latlng(h3_index)
        
        for neighbor in neighbors:
            neighbor_center = h3.cell_to_latlng(neighbor)
            direction = self._get_direction(center, neighbor_center)
            
            # Store relationship (if neighbor exists)
            if self.db.query(HexCell).filter_by(h3_index=neighbor).first():
                # Add to hex_neighbors table
                pass  # Implementation depends on schema
    
    def _get_direction(self, from_point: Tuple[float, float], to_point: Tuple[float, float]) -> str:
        """Get cardinal direction from one point to another"""
        lat1, lng1 = from_point
        lat2, lng2 = to_point
        
        # Simple bearing calculation
        dlng = lng2 - lng1
        dlat = lat2 - lat1
        
        if abs(dlat) > abs(dlng):
            return "north" if dlat > 0 else "south"
        else:
            return "east" if dlng > 0 else "west"
    
    def _build_join_response(self, hex_cell: HexCell, user_lat: float, user_lng: float) -> dict:
        """Build the response for joining a hex chat"""
        return {
            "hex_cell": HexCellResponse(
                h3_index=hex_cell.h3_index,
                resolution=hex_cell.resolution,
                center={"lat": hex_cell.center_lat, "lng": hex_cell.center_lng},
                display_name=hex_cell.display_name,
                locality=hex_cell.locality,
                active_users=hex_cell.active_users,
                boundary=self.get_hex_boundary(hex_cell.h3_index)
            ),
            "neighbors": self.get_active_neighbors(hex_cell.h3_index),
            "your_position": {"lat": user_lat, "lng": user_lng}
        }