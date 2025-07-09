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

@router.get("/test-auth")
async def test_auth(current_user: dict = Depends(get_current_user)):
    """Test authentication endpoint"""
    return {"message": "Auth working!", "user": current_user}

@router.get("/test-no-auth")
async def test_no_auth():
    """Test endpoint without auth"""
    from ..config import settings
    return {
        "message": "No auth endpoint working!", 
        "secret_key_first_10": settings.SECRET_KEY[:10],
        "secret_key_last_10": settings.SECRET_KEY[-10:]
    }

@router.post("/search", response_model=List[LocationResponse])
async def search_addresses(
    request: AddressSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

@router.post("/search-noauth", response_model=List[LocationResponse])
async def search_addresses_noauth(
    request: AddressSearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Search for addresses without auth"""
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