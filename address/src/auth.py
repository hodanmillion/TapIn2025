from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional, Dict, Any
import structlog

from .config import settings

logger = structlog.get_logger()

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get current user from JWT token"""
    try:
        logger.info(f"Attempting to decode JWT token", auth_header=credentials.scheme, token_preview=credentials.credentials[:20])
        logger.info(f"Using SECRET_KEY: {settings.SECRET_KEY[:10]}...")
        
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=["HS256"]
        )
        
        logger.info(f"JWT payload decoded successfully", user_id=payload.get("user_id"), username=payload.get("username"))
        
        user_id = payload.get("user_id") or payload.get("sub")
        if user_id is None:
            logger.error("No user_id or sub claim found in JWT")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        return {"user_id": user_id, **payload}
    
    except JWTError as e:
        logger.error(f"JWT decode error", error=str(e), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )