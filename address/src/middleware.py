from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import structlog
import time
from typing import Dict, Any
import redis.asyncio as redis

from .config import settings

logger = structlog.get_logger()

class LoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests and responses"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        logger.info(
            "Request started",
            method=request.method,
            url=str(request.url),
            client_ip=request.client.host
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        logger.info(
            "Request completed",
            method=request.method,
            url=str(request.url),
            status_code=response.status_code,
            duration_seconds=round(duration, 3)
        )
        
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis"""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.redis = redis.from_url(settings.REDIS_URL)
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host
        
        # Rate limit key
        key = f"rate_limit:{client_ip}"
        
        try:
            # Get current count
            current = await self.redis.get(key)
            
            if current is None:
                # First request in window
                await self.redis.setex(key, 60, 1)
            else:
                count = int(current)
                if count >= self.requests_per_minute:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Rate limit exceeded"}
                    )
                
                # Increment counter
                await self.redis.incr(key)
            
            # Process request
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.warning("Rate limit check failed, allowing request", error=str(e))
            # Allow request if Redis fails
            return await call_next(request)