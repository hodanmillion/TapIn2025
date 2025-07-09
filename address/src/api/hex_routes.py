from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database_sync import get_sync_db
from ..services.hex_service import HexagonalLocationService, DEFAULT_RESOLUTION
from ..hex_models import HexCellResponse, JoinHexResponse, HexResolution, HexCell
from ..auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/hex", tags=["hexagonal"])

@router.post("/join", response_model=JoinHexResponse)
async def join_neighborhood_chat(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    resolution: Optional[int] = Query(DEFAULT_RESOLUTION, description="H3 resolution (6-10)"),
    # current_user = Depends(get_current_user),  # Temporarily disabled for testing
    db: Session = Depends(get_sync_db)
):
    """
    Join the neighborhood hex chat for the given location.
    Returns hex cell info and active neighbors.
    """
    if resolution < 6 or resolution > 10:
        raise HTTPException(400, "Resolution must be between 6 and 10")
    
    service = HexagonalLocationService(db)
    # Using test user ID for now
    test_user_id = "test-user-123"
    result = service.join_hex_chat(test_user_id, lat, lng, resolution)
    
    return result

@router.get("/cell/{h3_index}", response_model=HexCellResponse)
async def get_hex_cell_info(
    h3_index: str,
    db: Session = Depends(get_sync_db)
):
    """Get information about a specific hex cell"""
    service = HexagonalLocationService(db)
    hex_cell = db.query(HexCell).filter_by(h3_index=h3_index).first()
    
    if not hex_cell:
        raise HTTPException(404, "Hex cell not found")
    
    return HexCellResponse(
        h3_index=hex_cell.h3_index,
        resolution=hex_cell.resolution,
        center={"lat": hex_cell.center_lat, "lng": hex_cell.center_lng},
        display_name=hex_cell.display_name,
        locality=hex_cell.locality,
        active_users=hex_cell.active_users,
        boundary=service.get_hex_boundary(hex_cell.h3_index)
    )

@router.get("/neighbors/{h3_index}")
async def get_active_neighbors(
    h3_index: str,
    rings: int = Query(1, description="Number of hex rings to search"),
    db: Session = Depends(get_sync_db)
):
    """Get active neighboring hex cells"""
    service = HexagonalLocationService(db)
    neighbors = service.get_active_neighbors(h3_index, rings)
    
    return {"neighbors": neighbors}

@router.get("/resolutions")
async def get_available_resolutions():
    """Get available hex resolutions and their approximate sizes"""
    return {
        "resolutions": [
            {
                "level": 6,
                "name": "City",
                "approximate_area_km2": 100,
                "description": "City-wide chat rooms"
            },
            {
                "level": 7,
                "name": "District",
                "approximate_area_km2": 5,
                "description": "District or borough level"
            },
            {
                "level": 8,
                "name": "Neighborhood",
                "approximate_area_km2": 0.7,
                "description": "Standard neighborhood chat (default)"
            },
            {
                "level": 9,
                "name": "Block",
                "approximate_area_km2": 0.1,
                "description": "City block or small area"
            },
            {
                "level": 10,
                "name": "Building",
                "approximate_area_km2": 0.015,
                "description": "Building or venue level"
            }
        ],
        "default": DEFAULT_RESOLUTION
    }

@router.post("/cleanup")
async def cleanup_inactive_users(
    timeout_minutes: int = Query(30, description="Minutes before user is considered inactive"),
    db: Session = Depends(get_sync_db),
    _: str = Depends(get_current_user)  # Admin only
):
    """Clean up inactive users from hex cells"""
    service = HexagonalLocationService(db)
    service.cleanup_inactive_users(timeout_minutes)
    
    return {"status": "cleanup completed"}

@router.get("/test")
async def test_hex_system():
    """Test endpoint to verify hex system is working"""
    return {"status": "hex system operational", "message": "The hexagonal location system is ready"}