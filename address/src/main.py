from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import structlog
from prometheus_client import make_asgi_app

from .database import init_db, close_db
from .routers import addresses, health, spatial_analysis
from . import test_endpoint, debug_auth
from .middleware import LoggingMiddleware, RateLimitMiddleware
from .config import settings

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting address service", port=settings.PORT)
    await init_db()
    yield
    # Shutdown
    await close_db()
    logger.info("Shutting down address service")

app = FastAPI(
    title="Address Service with Spatial Analysis",
    version="2.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

# Routes
app.include_router(addresses.router, prefix="/api/v1/addresses", tags=["addresses"])
app.include_router(spatial_analysis.router, prefix="/api/v1/spatial", tags=["spatial"])
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(test_endpoint.router, prefix="/api/v1/test", tags=["test"])
app.include_router(debug_auth.router, prefix="/api/v1/debug", tags=["debug"])

# Metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG
    )