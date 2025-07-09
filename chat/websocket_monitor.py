#!/usr/bin/env python3
"""
WebSocket Monitor for Tap-In Chat Service

This script connects to the WebSocket endpoint and monitors messages
to help debug frontend-backend communication issues.

Requirements:
    pip install websockets asyncio

Usage:
    python websocket_monitor.py [options]

Options:
    --host <host>     WebSocket server host (default: localhost)
    --port <port>     WebSocket server port (default: 3001)
    --location <id>   Location ID for the room (default: test-location)
    --scenario <name> Test scenario to run (default: join-chat)
    --verbose         Enable verbose logging
"""

import asyncio
import websockets
import json
import argparse
import datetime
import sys
from typing import Dict, Any, List

class WebSocketMonitor:
    def __init__(self, host='localhost', port=3001, location_id='test-location', verbose=False):
        self.host = host
        self.port = port
        self.location_id = location_id
        self.verbose = verbose
        self.message_log = []
        self.websocket = None
        
        # Test user data
        self.test_user = {
            'user_id': 'test-user-123',
            'username': 'TestUser',
            'token': 'test-jwt-token-123',
            'latitude': 37.7749,  # San Francisco coordinates
            'longitude': -122.4194,
            'search_radius': 5000
        }
    
    def log(self, message: str, level: str = 'INFO'):
        """Log a message with timestamp"""
        timestamp = datetime.datetime.now().isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}"
        print(log_entry)
        self.message_log.append(log_entry)
    
    def log_message(self, direction: str, message: Dict[str, Any]):
        """Log a WebSocket message"""
        timestamp = datetime.datetime.now().isoformat()
        arrow = '📤' if direction == 'SENT' else '📥'
        
        print(f"\n{arrow} {direction} [{timestamp}]:")
        print(json.dumps(message, indent=2))
        print('─' * 60)
        
        self.message_log.append({
            'timestamp': timestamp,
            'direction': direction,
            'message': message
        })
    
    def get_websocket_url(self) -> str:
        """Get the WebSocket URL"""
        protocol = 'ws' if self.host == 'localhost' else 'wss'
        return f"{protocol}://{self.host}:{self.port}/ws/{self.location_id}"
    
    async def send_message(self, message: Dict[str, Any]):
        """Send a message to the WebSocket"""
        if self.websocket:
            await self.websocket.send(json.dumps(message))
            self.log_message('SENT', message)
        else:
            self.log('WebSocket not connected', 'ERROR')
    
    async def scenario_join_chat(self):
        """Test JoinLocalChat scenario"""
        self.log('Testing JoinLocalChat scenario')
        
        join_message = {
            'type': 'JoinLocalChat',
            'user_id': self.test_user['user_id'],
            'username': self.test_user['username'],
            'token': self.test_user['token'],
            'latitude': self.test_user['latitude'],
            'longitude': self.test_user['longitude'],
            'search_radius': self.test_user['search_radius']
        }
        
        await self.send_message(join_message)
        
        # Wait for response, then send a test message
        await asyncio.sleep(2)
        
        test_message = {
            'type': 'Message',
            'data': {
                'content': 'Hello from WebSocket monitor!'
            }
        }
        await self.send_message(test_message)
    
    async def scenario_legacy_join(self):
        """Test legacy Join scenario"""
        self.log('Testing legacy Join scenario')
        
        join_message = {
            'type': 'Join',
            'user_id': self.test_user['user_id'],
            'username': self.test_user['username'],
            'token': self.test_user['token']
        }
        
        await self.send_message(join_message)
    
    async def scenario_auth_only(self):
        """Test Auth-only scenario"""
        self.log('Testing Auth-only scenario')
        
        auth_message = {
            'type': 'Auth',
            'user_id': self.test_user['user_id'],
            'username': self.test_user['username'],
            'token': self.test_user['token']
        }
        
        await self.send_message(auth_message)
    
    async def scenario_location_update(self):
        """Test LocationUpdate scenario"""
        self.log('Testing LocationUpdate scenario')
        
        # First join a chat
        join_message = {
            'type': 'JoinLocalChat',
            'user_id': self.test_user['user_id'],
            'username': self.test_user['username'],
            'token': self.test_user['token'],
            'latitude': self.test_user['latitude'],
            'longitude': self.test_user['longitude'],
            'search_radius': self.test_user['search_radius']
        }
        
        await self.send_message(join_message)
        
        # Then update location
        await asyncio.sleep(2)
        
        location_update = {
            'type': 'LocationUpdate',
            'user_id': self.test_user['user_id'],
            'latitude': self.test_user['latitude'] + 0.001,  # Move slightly
            'longitude': self.test_user['longitude'] + 0.001
        }
        await self.send_message(location_update)
    
    async def scenario_interactive(self):
        """Interactive mode for manual testing"""
        self.log('Starting interactive mode')
        self.log('Type WebSocket messages as JSON and press Enter to send')
        self.log('Type "quit" to exit')
        
        while True:
            try:
                user_input = input("\nEnter JSON message (or 'quit'): ")
                if user_input.strip().lower() == 'quit':
                    break
                
                message = json.loads(user_input)
                await self.send_message(message)
                
            except json.JSONDecodeError as e:
                self.log(f"Error parsing JSON: {e}", 'ERROR')
            except KeyboardInterrupt:
                break
    
    async def run_scenario(self, scenario_name: str):
        """Run a specific test scenario"""
        scenarios = {
            'join-chat': self.scenario_join_chat,
            'legacy-join': self.scenario_legacy_join,
            'auth-only': self.scenario_auth_only,
            'location-update': self.scenario_location_update,
            'interactive': self.scenario_interactive
        }
        
        if scenario_name in scenarios:
            await scenarios[scenario_name]()
        else:
            self.log(f"Unknown scenario: {scenario_name}", 'ERROR')
            self.log(f"Available scenarios: {', '.join(scenarios.keys())}")
    
    async def handle_message(self, message: str):
        """Handle incoming WebSocket message"""
        try:
            parsed_message = json.loads(message)
            self.log_message('RECEIVED', parsed_message)
        except json.JSONDecodeError:
            self.log_message('RECEIVED', {'raw': message})
    
    async def monitor(self, scenario: str):
        """Main monitoring function"""
        ws_url = self.get_websocket_url()
        self.log(f"Connecting to WebSocket: {ws_url}")
        
        try:
            async with websockets.connect(ws_url) as websocket:
                self.websocket = websocket
                self.log('WebSocket connection opened')
                
                # Start the scenario
                scenario_task = asyncio.create_task(self.run_scenario(scenario))
                
                # Listen for messages
                async for message in websocket:
                    await self.handle_message(message)
                    
        except websockets.exceptions.ConnectionClosed as e:
            self.log(f"WebSocket closed: {e}", 'INFO')
        except Exception as e:
            self.log(f"WebSocket error: {e}", 'ERROR')
        finally:
            self.websocket = None
            self.print_summary()
    
    def print_summary(self):
        """Print connection summary"""
        print('\n' + '=' * 60)
        print('CONNECTION SUMMARY')
        print('=' * 60)
        print(f"Total messages logged: {len(self.message_log)}")
        print(f"WebSocket URL: {self.get_websocket_url()}")
        print(f"Test User: {self.test_user['username']} ({self.test_user['user_id']})")
        print('=' * 60)
        
        # Save log to file
        if self.message_log:
            import time
            log_file = f"websocket_log_{int(time.time())}.json"
            with open(log_file, 'w') as f:
                json.dump(self.message_log, f, indent=2)
            print(f"Log saved to: {log_file}")

def main():
    parser = argparse.ArgumentParser(description='WebSocket Monitor for Tap-In Chat Service')
    parser.add_argument('--host', default='localhost', help='WebSocket server host')
    parser.add_argument('--port', type=int, default=3001, help='WebSocket server port')
    parser.add_argument('--location', default='test-location', help='Location ID for the room')
    parser.add_argument('--scenario', default='join-chat', 
                       choices=['join-chat', 'legacy-join', 'auth-only', 'location-update', 'interactive'],
                       help='Test scenario to run')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    print('WebSocket Monitor for Tap-In Chat Service')
    print('=========================================')
    print(f"Host: {args.host}")
    print(f"Port: {args.port}")
    print(f"Location ID: {args.location}")
    print(f"Scenario: {args.scenario}")
    print(f"Verbose: {args.verbose}")
    print()
    
    # Create and run monitor
    monitor = WebSocketMonitor(
        host=args.host,
        port=args.port,
        location_id=args.location,
        verbose=args.verbose
    )
    
    try:
        asyncio.run(monitor.monitor(args.scenario))
    except KeyboardInterrupt:
        print("\nReceived interrupt signal, shutting down...")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()