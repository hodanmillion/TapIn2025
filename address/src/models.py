from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from uuid import UUID
from shapely.geometry import Point, Polygon, MultiPolygon
import geopandas as gpd

class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    
    def to_shapely_point(self) -> Point:
        """Convert to Shapely Point"""
        return Point(self.longitude, self.latitude)
    
    @classmethod
    def from_shapely_point(cls, point: Point) -> "Coordinates":
        """Create from Shapely Point"""
        return cls(longitude=point.x, latitude=point.y)

class AddressComponents(BaseModel):
    street_number: Optional[str] = None
    street_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

class BoundingBox(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lat: float = Field(..., ge=-90, le=90)
    max_lon: float = Field(..., ge=-180, le=180)
    
    def to_shapely_polygon(self) -> Polygon:
        """Convert to Shapely Polygon"""
        return Polygon([
            (self.min_lon, self.min_lat),
            (self.max_lon, self.min_lat),
            (self.max_lon, self.max_lat),
            (self.min_lon, self.max_lat),
            (self.min_lon, self.min_lat)
        ])

class AddressSearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    limit: int = Field(5, ge=1, le=20)
    within_bbox: Optional[BoundingBox] = None
    
class AddressDetailRequest(BaseModel):
    place_id: Optional[str] = None
    address: Optional[str] = None
    coordinates: Optional[Coordinates] = None
    
    @validator('*', pre=True)
    def check_at_least_one(cls, v, values):
        if not any(values.values()) and v is None:
            raise ValueError('At least one field must be provided')
        return v

class LocationResponse(BaseModel):
    id: UUID
    place_id: str
    address_string: str
    normalized_address: str
    coordinates: Coordinates
    components: AddressComponents
    metadata: Dict[str, Any] = {}
    h3_index: Optional[str] = None  # H3 hex index for spatial indexing
    neighborhood: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class NearbySearchRequest(BaseModel):
    coordinates: Coordinates
    radius_meters: int = Field(1000, ge=10, le=50000)
    limit: int = Field(10, ge=1, le=50)

class PolygonSearchRequest(BaseModel):
    polygon: List[Tuple[float, float]]  # List of (lon, lat) tuples
    limit: int = Field(50, ge=1, le=200)
    
    def to_shapely_polygon(self) -> Polygon:
        """Convert to Shapely Polygon"""
        return Polygon(self.polygon)

class ChatRoomAtLocationResponse(BaseModel):
    location: LocationResponse
    active_users: int
    last_activity: Optional[datetime]
    distance_meters: Optional[float] = None

class SpatialCluster(BaseModel):
    cluster_id: int
    centroid: Coordinates
    locations: List[LocationResponse]
    radius_meters: float
    density: float  # locations per square km

class HeatmapData(BaseModel):
    coordinates: List[Coordinates]
    weights: List[float]
    h3_resolution: int = 7

class SpatialAnalysisResponse(BaseModel):
    total_locations: int
    clusters: List[SpatialCluster]
    hotspots: List[Dict[str, Any]]
    coverage_area_sqkm: float
    density_map: Optional[Dict[str, float]] = None  # H3 hex -> density