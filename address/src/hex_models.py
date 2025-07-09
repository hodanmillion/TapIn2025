from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional, List, Dict

Base = declarative_base()

# SQLAlchemy models
class HexCell(Base):
    __tablename__ = "hex_cells"
    
    h3_index = Column(String, primary_key=True)
    resolution = Column(Integer, nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    display_name = Column(String)
    locality = Column(String)
    active_users = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_locations = relationship("UserHexLocation", back_populates="hex_cell")

class UserHexLocation(Base):
    __tablename__ = "user_hex_locations"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False)
    h3_index = Column(String, ForeignKey("hex_cells.h3_index"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    hex_cell = relationship("HexCell", back_populates="user_locations")

class HexLandmark(Base):
    __tablename__ = "hex_landmarks"
    
    id = Column(Integer, primary_key=True)
    h3_index = Column(String, ForeignKey("hex_cells.h3_index"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# Pydantic models for API responses
class HexCellResponse(BaseModel):
    h3_index: str
    resolution: int
    center: Dict[str, float]
    display_name: Optional[str] = None
    locality: Optional[str] = None
    active_users: int
    boundary: List[List[float]]
    
    class Config:
        from_attributes = True

class NeighborhoodInfo(BaseModel):
    h3_index: str
    name: str
    active_users: int
    distance_km: float
    direction: str

class JoinHexResponse(BaseModel):
    hex_cell: HexCellResponse
    neighbors: List[NeighborhoodInfo]
    your_position: Dict[str, float]

class HexResolution(BaseModel):
    level: int
    name: str
    approximate_area_km2: float
    description: str