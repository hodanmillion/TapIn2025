import asyncio
import aiohttp
import json
import jwt
import websockets
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Test basic WebSocket connection to chat service"""
    
    # First authenticate
    async with aiohttp.ClientSession() as session:
        # Register
        register_data = {
            "email": "wstest@example.com",
            "username": "wstest",
            "password": "testpass123"
        }
        
        async with session.post(
            "http://localhost:8080/api/v1/auth/register",
            json=register_data
        ) as response:
            if response.status not in [200, 201]:
                logger.error(f"Registration failed: {response.status}")
                return
        
        # Login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        async with session.post(
            "http://localhost:8080/api/v1/auth/login",
            json=login_data
        ) as response:
            if response.status != 200:
                logger.error(f"Login failed: {response.status}")
                return
            
            data = await response.json()
            auth_token = data["access_token"]
            decoded_token = jwt.decode(auth_token, options={"verify_signature": False})
            user_id = decoded_token.get("user_id")
            username = decoded_token.get("username")
            
            logger.info(f"Authentication successful: user_id={user_id}")
    
    # Test WebSocket connection to a location-based room
    location_id = "test-location-123"
    ws_url = f"ws://localhost:3001/ws/{location_id}"
    
    try:
        async with websockets.connect(ws_url) as websocket:
            logger.info(f"Connected to WebSocket: {ws_url}")
            
            # Send join message
            join_message = {
                "type": "Join",
                "data": {
                    "user_id": user_id,
                    "username": username,
                    "token": auth_token
                }
            }
            
            await websocket.send(json.dumps(join_message))
            logger.info("Sent join message")
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            logger.info(f"Received: {response_data}")
            
            # Send a test message
            test_message = {
                "type": "SendMessage",
                "data": {
                    "content": "Hello from integration test!"
                }
            }
            
            await websocket.send(json.dumps(test_message))
            logger.info("Sent test message")
            
            # Wait for message echo
            message_response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            message_data = json.loads(message_response)
            logger.info(f"Received message: {message_data}")
            
            logger.info("✅ WebSocket test completed successfully!")
            
    except Exception as e:
        logger.error(f"❌ WebSocket test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_connection())