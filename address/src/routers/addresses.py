from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ..database import get_db
from ..models import (
    AddressSearchRequest,
    AddressDetailRequest,
    LocationResponse,
    NearbySearchRequest,
    ChatRoomAtLocationResponse
)
from ..services.address_service import AddressService
from ..auth import get_current_user

router = APIRouter()
address_service = AddressService()

@router.post("/search", response_model=List[LocationResponse])
async def search_addresses(
    request: AddressSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Search for addresses"""
    try:
        return await address_service.search_addresses(
            request.query,
            request.limit,
            request.within_bbox,
            db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detail", response_model=LocationResponse)
async def get_address_detail(
    request: AddressDetailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about an address"""
    try:
        return await address_service.get_or_create_location(
            request.place_id,
            request.address,
            request.coordinates,
            db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nearby", response_model=List[ChatRoomAtLocationResponse])
async def find_nearby_locations(
    request: NearbySearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Find locations near coordinates"""
    try:
        return await address_service.find_locations_near(
            request.coordinates,
            request.radius_meters,
            request.limit,
            db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch", response_model=List[LocationResponse])
async def batch_create_addresses(
    addresses: List[str],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Batch create multiple addresses"""
    try:
        return await address_service.batch_create_locations(addresses, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))