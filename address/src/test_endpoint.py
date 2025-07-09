from fastapi import APIRouter, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

router = APIRouter()
logger = structlog.get_logger()
security = HTTPBearer()

@router.get("/debug-headers")
async def debug_headers(request: Request):
    """Debug endpoint to see headers"""
    headers = dict(request.headers)
    return {
        "headers": headers,
        "authorization": headers.get("authorization", "NOT FOUND")
    }

@router.get("/debug-bearer")
async def debug_bearer(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Debug endpoint to see bearer token"""
    return {
        "scheme": credentials.scheme,
        "credentials": credentials.credentials[:50] + "..." if len(credentials.credentials) > 50 else credentials.credentials
    }