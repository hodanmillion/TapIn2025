from fastapi import APIRouter, Request, HTTPException
from typing import Optional
import structlog

router = APIRouter()
logger = structlog.get_logger()

@router.post("/debug-auth")
async def debug_auth(request: Request):
    """Debug auth headers"""
    headers = dict(request.headers)
    auth_header = headers.get("authorization", "")
    
    logger.info("Debug auth endpoint called", 
                has_auth_header=bool(auth_header),
                auth_header_preview=auth_header[:50] if auth_header else "NONE")
    
    if not auth_header:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=f"Invalid auth scheme: {auth_header[:10]}")
    
    token = auth_header[7:]  # Remove "Bearer "
    
    # Try to decode
    from jose import jwt
    from .config import settings
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return {
            "success": True,
            "user_id": payload.get("user_id"),
            "username": payload.get("username"),
            "secret_key_used": settings.SECRET_KEY[:10] + "..."
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "token_preview": token[:20] + "...",
            "secret_key_used": settings.SECRET_KEY[:10] + "..."
        }