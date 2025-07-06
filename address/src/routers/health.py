from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as redis

from ..database import get_db
from ..config import settings

router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "service": "address-service"}

@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check including dependencies"""
    try:
        # Check database
        await db.execute(text("SELECT 1"))
        
        # Check Redis
        redis_client = redis.from_url(settings.REDIS_URL)
        await redis_client.ping()
        await redis_client.close()
        
        return {"status": "ready", "database": "ok", "redis": "ok"}
    except Exception as e:
        return {"status": "not ready", "error": str(e)}