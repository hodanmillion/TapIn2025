import asyncio
import aiohttp
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_frontend_and_apis():
    """Test frontend availability and basic API endpoints"""
    
    async with aiohttp.ClientSession() as session:
        # Test frontend
        async with session.get("http://localhost:3080") as response:
            if response.status == 200:
                logger.info("✅ Frontend is accessible")
            else:
                logger.error(f"❌ Frontend failed: {response.status}")
        
        # Test auth service health
        async with session.get("http://localhost:8080/health") as response:
            if response.status == 200:
                logger.info("✅ Auth service is healthy")
            else:
                logger.error(f"❌ Auth service failed: {response.status}")
        
        # Test user service health
        async with session.get("http://localhost:3002/health") as response:
            if response.status == 200:
                logger.info("✅ User service is healthy")
            else:
                logger.error(f"❌ User service failed: {response.status}")
        
        # Test chat service health
        async with session.get("http://localhost:3001/health") as response:
            if response.status == 200:
                logger.info("✅ Chat service is healthy")
            else:
                logger.error(f"❌ Chat service failed: {response.status}")
        
        # Test address service health (this might fail due to import issue)
        try:
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    logger.info("✅ Address service is healthy")
                else:
                    logger.error(f"❌ Address service failed: {response.status}")
        except Exception as e:
            logger.error(f"❌ Address service error: {e}")
        
        # Test basic auth flow
        register_data = {
            "email": "e2etest@example.com",
            "username": "e2etest",
            "password": "testpass123"
        }
        
        async with session.post(
            "http://localhost:8080/api/v1/auth/register",
            json=register_data
        ) as response:
            if response.status in [200, 201]:
                logger.info("✅ User registration successful")
            else:
                logger.error(f"❌ Registration failed: {response.status}")
        
        # Test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        async with session.post(
            "http://localhost:8080/api/v1/auth/login",
            json=login_data
        ) as response:
            if response.status == 200:
                data = await response.json()
                if "access_token" in data:
                    logger.info("✅ User login successful")
                else:
                    logger.error("❌ Login response missing access_token")
            else:
                logger.error(f"❌ Login failed: {response.status}")

if __name__ == "__main__":
    asyncio.run(test_frontend_and_apis())