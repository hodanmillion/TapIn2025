from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import WKTElement
from geoalchemy2.functions import ST_Distance, ST_DWithin, ST_GeogFromText
from shapely.geometry import Point
from shapely.wkt import loads
import geopandas as gpd
import redis.asyncio as redis
import json
import hashlib
from datetime import datetime

from ..database import Location
from ..models import (
    LocationResponse, 
    Coordinates, 
    AddressComponents,
    ChatRoomAtLocationResponse,
    BoundingBox
)
from .geocoding import get_geocoding_provider
from .spatial_service import SpatialAnalysisService
from ..config import settings
import structlog

logger = structlog.get_logger()

class AddressService:
    def __init__(self):
        self.geocoder = get_geocoding_provider()
        try:
            self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warning("Redis connection failed, caching disabled", error=str(e))
            self.redis = None
        self.spatial = SpatialAnalysisService()
    
    def _cache_key(self, prefix: str, identifier: str) -> str:
        """Generate cache key"""
        return f"address:{prefix}:{hashlib.md5(identifier.encode()).hexdigest()}"
    
    async def search_addresses(
        self, 
        query: str, 
        limit: int,
        within_bbox: Optional[BoundingBox],
        db: AsyncSession
    ) -> List[LocationResponse]:
        """Search for addresses using geocoding provider"""
        
        # Check cache first
        cache_key = self._cache_key("search", f"{query}:{limit}:{within_bbox}")
        if self.redis:
            try:
                cached = await self.redis.get(cache_key)
                if cached:
                    return [LocationResponse(**item) for item in json.loads(cached)]
            except Exception as e:
                logger.warning("Cache read failed", error=str(e))
        
        # Search using geocoding provider
        results = await self.geocoder.search_places(query, limit)
        
        # Filter by bounding box if provided
        if within_bbox:
            bbox_polygon = within_bbox.to_shapely_polygon()
            results = [
                r for r in results
                if bbox_polygon.contains(
                    Point(r['coordinates']['longitude'], r['coordinates']['latitude'])
                )
            ]
        
        locations = []
        for result in results:
            # Check if location already exists in DB
            existing = await db.execute(
                select(Location).where(Location.place_id == result['place_id'])
            )
            location = existing.scalar_one_or_none()
            
            if not location:
                # Create new location
                location = await self._create_location_from_geocode(result, db)
            
            # Add H3 index
            response = self._to_response(location)
            response.h3_index = self.spatial.calculate_h3_indices(
                response.coordinates.latitude,
                response.coordinates.longitude
            )
            locations.append(response)
        
        # Cache results
        if self.redis:
            try:
                await self.redis.setex(
                    cache_key,
                    settings.REDIS_CACHE_TTL,
                    json.dumps([loc.model_dump(mode='json') for loc in locations])
                )
            except Exception as e:
                logger.warning("Cache write failed", error=str(e))
        
        return locations
    
    async def get_or_create_location(
        self,
        place_id: Optional[str],
        address: Optional[str],
        coordinates: Optional[Coordinates],
        db: AsyncSession
    ) -> LocationResponse:
        """Get existing location or create new one"""
        
        # Try to find by place_id first
        if place_id:
            existing = await db.execute(
                select(Location).where(Location.place_id == place_id)
            )
            location = existing.scalar_one_or_none()
            if location:
                response = self._to_response(location)
                response.h3_index = self.spatial.calculate_h3_indices(
                    response.coordinates.latitude,
                    response.coordinates.longitude
                )
                return response
        
        # Geocode based on what we have
        if address:
            geocoded = await self.geocoder.geocode(address)
        elif coordinates:
            geocoded = await self.geocoder.reverse_geocode(
                coordinates.latitude,
                coordinates.longitude
            )
        else:
            raise ValueError("Must provide place_id, address, or coordinates")
        
        if not geocoded:
            raise ValueError("Could not geocode the provided location")
        
        # Check if this place_id already exists
        existing = await db.execute(
            select(Location).where(Location.place_id == geocoded['place_id'])
        )
        location = existing.scalar_one_or_none()
        
        if not location:
            location = await self._create_location_from_geocode(geocoded, db)
        
        response = self._to_response(location)
        response.h3_index = self.spatial.calculate_h3_indices(
            response.coordinates.latitude,
            response.coordinates.longitude
        )
        return response
    
    async def find_locations_near(
        self,
        coordinates: Coordinates,
        radius_meters: int,
        limit: int,
        db: AsyncSession
    ) -> List[ChatRoomAtLocationResponse]:
        """Find locations with chat rooms near coordinates using PostGIS"""
        
        # Create Shapely point
        search_point = coordinates.to_shapely_point()
        
        # Query with PostGIS spatial functions
        query = text("""
            SELECT 
                l.*,
                ST_Distance(
                    l.coordinates::geography,
                    ST_GeogFromText(:point)
                ) as distance_meters
            FROM locations l
            WHERE ST_DWithin(
                l.coordinates::geography,
                ST_GeogFromText(:point),
                :radius
            )
            ORDER BY distance_meters
            LIMIT :limit
        """)
        
        result = await db.execute(
            query,
            {
                "point": f'POINT({search_point.x} {search_point.y})',
                "radius": radius_meters,
                "limit": limit
            }
        )
        
        locations = []
        for row in result:
            # Parse geometry using Shapely
            geom = loads(row.coordinates.data) if hasattr(row.coordinates, 'data') else None
            if geom:
                coords = Coordinates(latitude=geom.y, longitude=geom.x)
            else:
                coords = Coordinates(latitude=0, longitude=0)
            
            location = LocationResponse(
                id=row.id,
                place_id=row.place_id,
                address_string=row.address_string,
                normalized_address=row.normalized_address,
                coordinates=coords,
                components=AddressComponents(
                    street_number=row.street_number,
                    street_name=row.street_name,
                    city=row.city,
                    state=row.state,
                    country=row.country,
                    postal_code=row.postal_code
                ),
                metadata=row.extra_metadata,
                h3_index=self.spatial.calculate_h3_indices(coords.latitude, coords.longitude),
                created_at=row.created_at
            )
            
            # Get active users from Redis
            active_users = 0
            if self.redis:
                try:
                    active_users = await self.redis.scard(f"location:{row.id}:users")
                except Exception as e:
                    logger.warning("Failed to get active users", error=str(e))
            
            locations.append(ChatRoomAtLocationResponse(
                location=location,
                active_users=active_users or 0,
                last_activity=None,  # TODO: Track this
                distance_meters=row.distance_meters
            ))
        
        return locations
    
    async def batch_create_locations(
        self,
        addresses: List[str],
        db: AsyncSession
    ) -> List[LocationResponse]:
        """Batch create multiple locations"""
        
        # Batch geocode
        geocoded_results = await self.geocoder.batch_geocode(addresses)
        
        locations = []
        for geocoded in geocoded_results:
            if geocoded:
                # Check if exists
                existing = await db.execute(
                    select(Location).where(Location.place_id == geocoded['place_id'])
                )
                location = existing.scalar_one_or_none()
                
                if not location:
                    location = await self._create_location_from_geocode(geocoded, db)
                
                response = self._to_response(location)
                response.h3_index = self.spatial.calculate_h3_indices(
                    response.coordinates.latitude,
                    response.coordinates.longitude
                )
                locations.append(response)
        
        return locations
    
    async def _create_location_from_geocode(
        self, 
        geocoded: dict, 
        db: AsyncSession
    ) -> Location:
        """Create new location from geocoded data"""
        
        coords = geocoded['coordinates']
        components = geocoded['components']
        
        # Create Shapely point
        point = Point(coords['longitude'], coords['latitude'])
        
        # Convert to WKT for PostGIS
        wkt_point = WKTElement(point.wkt, srid=4326)
        
        location = Location(
            place_id=geocoded['place_id'],
            address_string=geocoded['address_string'],
            normalized_address=self._normalize_address(geocoded['address_string']),
            coordinates=wkt_point,
            street_number=components.get('street_number'),
            street_name=components.get('street_name'),
            city=components.get('city'),
            state=components.get('state'),
            country=components.get('country'),
            postal_code=components.get('postal_code'),
            extra_metadata=geocoded.get('metadata', {})
        )
        
        db.add(location)
        await db.commit()
        await db.refresh(location)
        
        logger.info(
            "Created new location",
            place_id=location.place_id,
            address=location.address_string
        )
        
        return location
    
    def _normalize_address(self, address: str) -> str:
        """Normalize address for matching"""
        # Enhanced normalization
        normalized = address.lower().strip()
        
        # Common abbreviations
        replacements = {
            ' street': ' st',
            ' avenue': ' ave',
            ' road': ' rd',
            ' boulevard': ' blvd',
            ' drive': ' dr',
            ' lane': ' ln',
            ' court': ' ct',
            ' north ': ' n ',
            ' south ': ' s ',
            ' east ': ' e ',
            ' west ': ' w ',
        }
        
        for old, new in replacements.items():
            normalized = normalized.replace(old, new)
        
        # Remove extra spaces
        normalized = ' '.join(normalized.split())
        
        return normalized
    
    def _to_response(self, location: Location) -> LocationResponse:
        """Convert database model to response model"""
        
        # Extract coordinates using Shapely
        if hasattr(location.coordinates, 'data'):
            # Handle different geometry formats
            try:
                geom = loads(location.coordinates.data)
                lat, lng = geom.y, geom.x
            except:
                lat, lng = 0, 0
        else:
            lat, lng = 0, 0
        
        return LocationResponse(
            id=location.id,
            place_id=location.place_id,
            address_string=location.address_string,
            normalized_address=location.normalized_address,
            coordinates=Coordinates(latitude=lat, longitude=lng),
            components=AddressComponents(
                street_number=location.street_number,
                street_name=location.street_name,
                city=location.city,
                state=location.state,
                country=location.country,
                postal_code=location.postal_code
            ),
            metadata=location.extra_metadata or {},
            created_at=location.created_at
        )