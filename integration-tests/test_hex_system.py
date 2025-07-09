import pytest
import asyncio
import aiohttp
import json
from typing import Dict, Any
import time
import websockets
import logging
import jwt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HexSystemIntegrationTest:
    """Integration tests for the complete hexagonal system"""
    
    def __init__(self):
        self.base_url = "http://localhost"
        self.address_url = "http://localhost:8000"
        self.chat_url = "http://localhost:3001"
        self.auth_url = "http://localhost:8080"
        self.user_url = "http://localhost:3002"
        self.websocket_url = "ws://localhost:3001"
        
        self.auth_token = None
        self.user_id = None
        self.session = None
    
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession()
        await self.authenticate()
    
    async def teardown(self):
        """Clean up test environment"""
        if self.session:
            await self.session.close()
    
    async def authenticate(self):
        """Authenticate and get JWT token"""
        # Register test user
        register_data = {
            "email": f"hextest_{int(time.time())}@example.com",
            "username": f"hextest_{int(time.time())}",
            "password": "testpassword123"
        }
        
        async with self.session.post(
            f"{self.auth_url}/api/v1/auth/register",
            json=register_data
        ) as response:
            if response.status in [200, 201]:
                logger.info("User registered successfully")
            else:
                logger.error(f"Registration failed: {response.status}")
                return False
        
        # Login to get token
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        async with self.session.post(
            f"{self.auth_url}/api/v1/auth/login",
            json=login_data
        ) as response:
            if response.status == 200:
                data = await response.json()
                self.auth_token = data["access_token"]
                # Decode JWT to get user_id
                decoded_token = jwt.decode(self.auth_token, options={"verify_signature": False})
                self.user_id = decoded_token.get("user_id")
                logger.info(f"Authentication successful, user_id: {self.user_id}")
                return True
            else:
                logger.error(f"Login failed: {response.status}")
                return False
    
    async def test_hex_join_flow(self):
        """Test the complete hex join flow"""
        logger.info("Testing hex join flow...")
        
        # Test coordinates (NYC)
        lat, lng = 40.7589, -73.9851
        resolution = 8
        
        # Join hex through address service
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        async with self.session.post(
            f"{self.address_url}/api/v1/hex/join",
            params={"lat": lat, "lng": lng, "resolution": resolution},
            headers=headers
        ) as response:
            assert response.status == 200, f"Hex join failed: {response.status}"
            
            data = await response.json()
            assert "hex_cell" in data
            assert "neighbors" in data
            assert "your_position" in data
            
            hex_cell = data["hex_cell"]
            assert hex_cell["h3_index"]
            assert hex_cell["resolution"] == resolution
            assert hex_cell["center"]["lat"] == lat
            assert hex_cell["center"]["lng"] == lng
            assert len(hex_cell["boundary"]) == 6  # Hexagon has 6 vertices
            
            logger.info(f"Successfully joined hex: {hex_cell['h3_index']}")
            return hex_cell
    
    async def test_hex_info_retrieval(self, h3_index: str):
        """Test retrieving hex cell information"""
        logger.info(f"Testing hex info retrieval for {h3_index}...")
        
        async with self.session.get(
            f"{self.address_url}/api/v1/hex/cell/{h3_index}"
        ) as response:
            assert response.status == 200, f"Hex info retrieval failed: {response.status}"
            
            data = await response.json()
            assert data["h3_index"] == h3_index
            assert "resolution" in data
            assert "center" in data
            assert "boundary" in data
            
            logger.info(f"Successfully retrieved hex info for {h3_index}")
            return data
    
    async def test_hex_neighbors(self, h3_index: str):
        """Test getting hex neighbors"""
        logger.info(f"Testing hex neighbors for {h3_index}...")
        
        async with self.session.get(
            f"{self.address_url}/api/v1/hex/neighbors/{h3_index}",
            params={"rings": 1}
        ) as response:
            assert response.status == 200, f"Hex neighbors failed: {response.status}"
            
            data = await response.json()
            assert "neighbors" in data
            
            neighbors = data["neighbors"]
            logger.info(f"Found {len(neighbors)} neighbors for {h3_index}")
            
            for neighbor in neighbors:
                assert "h3_index" in neighbor
                assert "name" in neighbor
                assert "active_users" in neighbor
                assert "distance_km" in neighbor
                assert "direction" in neighbor
            
            return neighbors
    
    async def test_websocket_connection(self, h3_index: str):
        """Test WebSocket connection to hex chat"""
        logger.info(f"Testing WebSocket connection for hex {h3_index}...")
        
        websocket_url = f"{self.websocket_url}/ws/hex/{h3_index}"
        
        try:
            async with websockets.connect(websocket_url) as websocket:
                # Send join message
                join_message = {
                    "type": "JoinHex",
                    "data": {
                        "h3_index": h3_index,
                        "user_info": {
                            "user_id": self.user_id,
                            "username": f"testuser_{int(time.time())}"
                        }
                    }
                }
                
                await websocket.send(json.dumps(join_message))
                
                # Wait for join confirmation
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                
                assert response_data["type"] == "HexJoined"
                assert response_data["data"]["hex_info"]["h3_index"] == h3_index
                
                logger.info(f"Successfully connected to hex WebSocket: {h3_index}")
                
                # Test sending a message
                message = {
                    "type": "SendMessage",
                    "data": {
                        "content": "Hello from integration test!"
                    }
                }
                
                await websocket.send(json.dumps(message))
                
                # Wait for message echo
                message_response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                message_data = json.loads(message_response)
                
                assert message_data["type"] == "NewMessage"
                assert message_data["data"]["message"]["content"] == "Hello from integration test!"
                
                logger.info("Successfully sent and received message via WebSocket")
                return True
                
        except Exception as e:
            logger.error(f"WebSocket test failed: {e}")
            return False
    
    async def test_multiple_users_same_hex(self, h3_index: str):
        """Test multiple users in the same hex"""
        logger.info(f"Testing multiple users in hex {h3_index}...")
        
        # Create second user
        test2 = HexSystemIntegrationTest()
        await test2.setup()
        
        try:
            # Both users join the same hex
            websocket_url = f"{self.websocket_url}/ws/hex/{h3_index}"
            
            async with websockets.connect(websocket_url) as ws1:
                async with websockets.connect(websocket_url) as ws2:
                    # User 1 joins
                    join_msg1 = {
                        "type": "JoinHex",
                        "data": {
                            "h3_index": h3_index,
                            "user_info": {
                                "user_id": self.user_id,
                                "username": "user1"
                            }
                        }
                    }
                    await ws1.send(json.dumps(join_msg1))
                    
                    # User 2 joins
                    join_msg2 = {
                        "type": "JoinHex",
                        "data": {
                            "h3_index": h3_index,
                            "user_info": {
                                "user_id": test2.user_id,
                                "username": "user2"
                            }
                        }
                    }
                    await ws2.send(json.dumps(join_msg2))
                    
                    # Wait for join confirmations
                    await asyncio.wait_for(ws1.recv(), timeout=5.0)
                    await asyncio.wait_for(ws2.recv(), timeout=5.0)
                    
                    # User 1 sends message
                    message = {
                        "type": "SendMessage",
                        "data": {
                            "content": "Message from user1"
                        }
                    }
                    await ws1.send(json.dumps(message))
                    
                    # Both users should receive the message
                    msg1 = await asyncio.wait_for(ws1.recv(), timeout=5.0)
                    msg2 = await asyncio.wait_for(ws2.recv(), timeout=5.0)
                    
                    data1 = json.loads(msg1)
                    data2 = json.loads(msg2)
                    
                    assert data1["type"] == "NewMessage"
                    assert data2["type"] == "NewMessage"
                    assert data1["data"]["message"]["content"] == "Message from user1"
                    assert data2["data"]["message"]["content"] == "Message from user1"
                    
                    logger.info("Successfully tested multiple users in same hex")
                    return True
                    
        except Exception as e:
            logger.error(f"Multiple users test failed: {e}")
            return False
        finally:
            await test2.teardown()
    
    async def test_resolutions_endpoint(self):
        """Test the resolutions endpoint"""
        logger.info("Testing resolutions endpoint...")
        
        async with self.session.get(
            f"{self.address_url}/api/v1/hex/resolutions"
        ) as response:
            assert response.status == 200, f"Resolutions endpoint failed: {response.status}"
            
            data = await response.json()
            assert "resolutions" in data
            assert "default" in data
            
            resolutions = data["resolutions"]
            assert len(resolutions) == 5  # 6, 7, 8, 9, 10
            
            # Check default resolution
            default_res = next(r for r in resolutions if r["level"] == data["default"])
            assert default_res["name"] == "Neighborhood"
            
            logger.info("Successfully tested resolutions endpoint")
            return data
    
    async def run_all_tests(self):
        """Run all integration tests"""
        logger.info("Starting hex system integration tests...")
        
        try:
            # Test 1: Join hex
            hex_cell = await self.test_hex_join_flow()
            h3_index = hex_cell["h3_index"]
            
            # Test 2: Get hex info
            await self.test_hex_info_retrieval(h3_index)
            
            # Test 3: Get neighbors
            await self.test_hex_neighbors(h3_index)
            
            # Test 4: WebSocket connection
            await self.test_websocket_connection(h3_index)
            
            # Test 5: Multiple users
            await self.test_multiple_users_same_hex(h3_index)
            
            # Test 6: Resolutions endpoint
            await self.test_resolutions_endpoint()
            
            logger.info("✅ All integration tests passed!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Integration test failed: {e}")
            return False


async def main():
    """Run the integration tests"""
    logger.info("Starting hex system integration tests...")
    
    # Wait for services to be ready
    await asyncio.sleep(10)
    
    test = HexSystemIntegrationTest()
    
    try:
        await test.setup()
        success = await test.run_all_tests()
        
        if success:
            logger.info("🎉 All integration tests completed successfully!")
        else:
            logger.error("❌ Some integration tests failed")
            
    finally:
        await test.teardown()


if __name__ == "__main__":
    asyncio.run(main())