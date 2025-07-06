#!/usr/bin/env python3
"""
Startup script for the address service
"""
import asyncio
import uvicorn
from src.database import init_db
from src.config import settings

async def setup_database():
    """Initialize database with PostGIS"""
    try:
        await init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        print("💡 Make sure PostgreSQL with PostGIS is running:")
        print("   docker-compose up -d postgres")
        return False
    return True

def main():
    """Main application entry point"""
    
    print("🚀 Starting Address Service with PostGIS")
    print(f"📊 Database: {settings.DATABASE_URL}")
    print(f"🌐 Server will run on port {settings.PORT}")
    
    # Check database connection
    try:
        success = asyncio.run(setup_database())
        if not success:
            return
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        return
    
    print("🎯 Starting FastAPI server...")
    
    # Start the server
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0", 
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )

if __name__ == "__main__":
    main()