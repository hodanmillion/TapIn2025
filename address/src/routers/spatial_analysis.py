from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from ..database import get_db
from ..models import (
    LocationResponse,
    PolygonSearchRequest,
    SpatialAnalysisResponse,
    HeatmapData,
    Coordinates
)
from ..services.address_service import AddressService
from ..services.spatial_service import SpatialAnalysisService
from ..auth import get_current_user

router = APIRouter()
address_service = AddressService()
spatial_service = SpatialAnalysisService()

@router.post("/analyze", response_model=SpatialAnalysisResponse)
async def analyze_spatial_distribution(
    location_ids: List[str],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Analyze spatial distribution of locations"""
    try:
        # Fetch locations from database
        from sqlalchemy import select
        from ..database import Location
        import uuid
        
        location_uuids = [uuid.UUID(lid) for lid in location_ids]
        result = await db.execute(
            select(Location).where(Location.id.in_(location_uuids))
        )
        locations_db = result.scalars().all()
        
        # Convert to response models
        locations = [address_service._to_response(loc) for loc in locations_db]
        
        # Find clusters
        clusters = spatial_service.find_clusters(locations)
        
        # Calculate statistics
        stats = spatial_service.calculate_spatial_statistics(locations)
        
        # Create H3 heatmap
        density_map = spatial_service.create_h3_heatmap(locations)
        
        return SpatialAnalysisResponse(
            total_locations=stats['total_locations'],
            clusters=clusters,
            hotspots=[],  # Can be extended
            coverage_area_sqkm=stats['coverage_area_sqkm'],
            density_map=density_map
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/polygon", response_model=List[LocationResponse])
async def search_in_polygon(
    request: PolygonSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Find all locations within a polygon"""
    try:
        # Get all locations (in production, add spatial index query)
        from sqlalchemy import select
        from ..database import Location
        
        result = await db.execute(select(Location))
        locations_db = result.scalars().all()
        locations = [address_service._to_response(loc) for loc in locations_db]
        
        # Filter by polygon
        polygon = request.to_shapely_polygon()
        filtered = spatial_service.find_locations_in_polygon(locations, polygon)
        
        return filtered[:request.limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heatmap")
async def generate_heatmap(
    heatmap_data: HeatmapData,
    current_user: dict = Depends(get_current_user)
):
    """Generate heatmap HTML"""
    try:
        # Create folium map with heatmap
        html = spatial_service.create_folium_map(
            locations=[],
            heatmap_data=heatmap_data
        )
        
        return Response(content=html, media_type="text/html")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/map/{location_id}")
async def get_location_map(
    location_id: str,
    radius_km: float = 1.0,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Generate map centered on a location"""
    try:
        # Get location
        from sqlalchemy import select
        from ..database import Location
        import uuid
        
        location_uuid = uuid.UUID(location_id)
        result = await db.execute(
            select(Location).where(Location.id == location_uuid)
        )
        location_db = result.scalar_one_or_none()
        
        if not location_db:
            raise HTTPException(status_code=404, detail="Location not found")
        
        location = address_service._to_response(location_db)
        
        # Find nearby locations
        nearby = await address_service.find_locations_near(
            location.coordinates,
            int(radius_km * 1000),
            50,
            db
        )
        
        # Create map
        locations = [n.location for n in nearby]
        html = spatial_service.create_folium_map(locations)
        
        return Response(content=html, media_type="text/html")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nearest")
async def find_nearest_locations(
    target: Coordinates,
    k: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Find k nearest locations to a coordinate"""
    try:
        # Get all locations (in production, use spatial index)
        from sqlalchemy import select
        from ..database import Location
        
        result = await db.execute(select(Location))
        locations_db = result.scalars().all()
        locations = [address_service._to_response(loc) for loc in locations_db]
        
        # Find nearest neighbors
        nearest = spatial_service.find_nearest_neighbors(target, locations, k)
        
        return [
            {
                "location": loc,
                "distance_meters": dist
            }
            for loc, dist in nearest
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))