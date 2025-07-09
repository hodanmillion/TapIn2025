# WebSocket Monitoring Tools

This directory contains several tools to help monitor and debug WebSocket communication between the frontend and backend of the Tap-In Chat Service.

## Overview

The chat service expects specific WebSocket message formats based on the `WsMessage` enum in `src/models.rs`. These tools help you:

1. **Monitor** WebSocket messages being sent/received
2. **Test** different message scenarios
3. **Debug** communication issues between frontend and backend
4. **Validate** message formats and responses

## Expected Message Formats

Based on the backend code, the following message types are supported:

### 1. JoinLocalChat (Primary)
```json
{
  "type": "JoinLocalChat",
  "user_id": "user123",
  "username": "TestUser",
  "token": "jwt-token-here",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "search_radius": 5000
}
```

### 2. Legacy Join
```json
{
  "type": "Join",
  "user_id": "user123",
  "username": "TestUser",
  "token": "jwt-token-here"
}
```

### 3. Auth Only
```json
{
  "type": "Auth",
  "user_id": "user123",
  "username": "TestUser",
  "token": "jwt-token-here"
}
```

### 4. Send Message
```json
{
  "type": "Message",
  "data": {
    "content": "Hello, world!"
  }
}
```

### 5. Location Update
```json
{
  "type": "LocationUpdate",
  "user_id": "user123",
  "latitude": 37.7750,
  "longitude": -122.4195
}
```

### 6. Typing Indicator
```json
{
  "type": "Typing",
  "is_typing": true
}
```

## Available Tools

### 1. Browser-based Monitor (Recommended)

**File:** `browser_websocket_monitor.html`

A complete HTML page with a user interface for monitoring WebSocket messages.

**Features:**
- Real-time WebSocket connection monitoring
- Pre-configured quick-send buttons for common scenarios
- Custom message editor with JSON validation
- Message log with timestamps and direction indicators
- Easy-to-use web interface

**Usage:**
1. Open `browser_websocket_monitor.html` in your web browser
2. Configure the WebSocket URL (default: `ws://localhost:3001/ws/test-location`)
3. Set user credentials and location
4. Click "Connect" to establish WebSocket connection
5. Use quick-send buttons or custom message editor to test scenarios

### 2. Python Monitor

**File:** `websocket_monitor.py`

A Python script for command-line WebSocket monitoring.

**Requirements:**
```bash
pip install websockets asyncio
```

**Usage:**
```bash
# Basic usage
python websocket_monitor.py

# Custom host and port
python websocket_monitor.py --host example.com --port 8080

# Different scenarios
python websocket_monitor.py --scenario join-chat
python websocket_monitor.py --scenario legacy-join
python websocket_monitor.py --scenario auth-only
python websocket_monitor.py --scenario location-update
python websocket_monitor.py --scenario interactive

# Verbose logging
python websocket_monitor.py --verbose
```

### 3. Node.js Monitor

**File:** `websocket_monitor.js`

A Node.js script for monitoring WebSocket connections.

**Requirements:**
```bash
npm install ws
```

**Usage:**
```bash
# Basic usage
node websocket_monitor.js

# Custom configuration
node websocket_monitor.js --host localhost --port 3001 --location test-room

# Different scenarios
node websocket_monitor.js --scenario join-chat
node websocket_monitor.js --scenario interactive --verbose

# Help
node websocket_monitor.js --help
```

## Testing Scenarios

### Scenario 1: Join Local Chat (Primary Use Case)

This tests the main geolocation-based chat functionality:

1. Send `JoinLocalChat` message with user credentials and location
2. Backend should respond with `RoomJoined` message
3. Backend should send `MessageHistory` with recent messages
4. Send a test message to verify message sending works

**Expected Response Flow:**
```
SENT -> JoinLocalChat
RECEIVED <- RoomJoined
RECEIVED <- MessageHistory
SENT -> Message
RECEIVED <- NewMessage (broadcast)
```

### Scenario 2: Legacy Join

Tests the deprecated join functionality:

1. Send `Join` message with user credentials
2. Backend should respond with `UserJoined` message

### Scenario 3: Auth Only

Tests authentication without joining a room:

1. Send `Auth` message with user credentials
2. Backend should respond with `UserJoined` message

### Scenario 4: Location Update

Tests location updates after joining:

1. Send `JoinLocalChat` to join a room
2. Wait for join confirmation
3. Send `LocationUpdate` with new coordinates
4. Monitor for any responses or room changes

## Common Issues and Debugging

### Issue 1: Connection Refused

**Symptoms:** WebSocket connection fails immediately
**Possible Causes:**
- Backend server not running
- Wrong host/port configuration
- Network connectivity issues

**Debug Steps:**
1. Check if backend is running: `curl http://localhost:3001/health`
2. Verify WebSocket endpoint: `ws://localhost:3001/ws/test-location`
3. Check server logs for errors

### Issue 2: No Response to Messages

**Symptoms:** Messages sent but no response received
**Possible Causes:**
- Invalid message format
- Missing required fields
- Backend processing errors

**Debug Steps:**
1. Verify message matches expected format exactly
2. Check all required fields are present
3. Monitor backend logs for parsing errors
4. Test with different message types

### Issue 3: Unexpected Message Format

**Symptoms:** Receiving messages in unexpected format
**Possible Causes:**
- Frontend expecting different format than backend sends
- Version mismatch between frontend and backend
- Serialization/deserialization issues

**Debug Steps:**
1. Compare received messages with expected format
2. Check `WsMessage` enum in `src/models.rs`
3. Verify JSON serialization settings

## Sample Message Flows

### Successful Join Local Chat Flow

```
1. Client -> Server: JoinLocalChat
{
  "type": "JoinLocalChat",
  "user_id": "user123",
  "username": "TestUser",
  "token": "jwt-token",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "search_radius": 5000
}

2. Server -> Client: RoomJoined
{
  "type": "RoomJoined",
  "room_id": "room_id_here",
  "room_name": "Local Chat Room",
  "is_new_room": true,
  "user_count": 1,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  }
}

3. Server -> Client: MessageHistory
{
  "type": "MessageHistory",
  "messages": [...]
}

4. Client -> Server: Message
{
  "type": "Message",
  "data": {
    "content": "Hello everyone!"
  }
}

5. Server -> Client: NewMessage
{
  "type": "NewMessage",
  "id": "message_id",
  "room_id": "room_id_here",
  "user_id": "user123",
  "username": "TestUser",
  "content": "Hello everyone!",
  "timestamp": "2023-12-07T10:30:00Z",
  "edited_at": null,
  "deleted": false,
  "reactions": []
}
```

## Tips for Effective Monitoring

1. **Start Simple:** Begin with the browser monitor for easy visualization
2. **Test Incrementally:** Test one message type at a time
3. **Save Logs:** All tools can save message logs for later analysis
4. **Monitor Both Directions:** Pay attention to both sent and received messages
5. **Check Timestamps:** Verify message ordering and timing
6. **Test Edge Cases:** Try invalid messages, missing fields, etc.
7. **Use Interactive Mode:** For custom testing scenarios

## Integration with Browser DevTools

If you have a frontend application, you can also monitor WebSocket messages using browser DevTools:

1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Look for WebSocket connections
5. Click on a connection to see message frames
6. Monitor the "Messages" tab for real-time communication

This provides additional insight into what the actual frontend is sending versus what these test tools send.

## Troubleshooting

### Tool Installation Issues

**Python Issues:**
```bash
# If websockets module not found
pip install websockets

# If asyncio issues (Python < 3.7)
pip install asyncio
```

**Node.js Issues:**
```bash
# If ws module not found
npm install ws

# Global installation
npm install -g ws
```

### Common Configuration Problems

1. **Wrong URL Format:** Use `ws://` for local, `wss://` for HTTPS
2. **CORS Issues:** Backend has CORS enabled, but check configuration
3. **Port Conflicts:** Ensure backend is running on expected port
4. **Location ID:** Make sure location ID in URL matches expectations

### Backend Server Issues

1. **Check Health Endpoint:** `curl http://localhost:3001/health`
2. **Verify Dependencies:** MongoDB and Redis should be running
3. **Check Logs:** Look for startup errors or runtime issues
4. **Test REST Endpoints:** Verify basic API functionality first

## Next Steps

After monitoring WebSocket messages, you can:

1. **Identify Discrepancies:** Compare frontend messages with expected format
2. **Fix Message Format:** Update frontend to send correct message structure
3. **Implement Missing Handlers:** Add support for missing message types
4. **Optimize Performance:** Identify bottlenecks in message processing
5. **Add Error Handling:** Implement proper error responses and handling

These tools provide comprehensive visibility into WebSocket communication, helping you debug and optimize the chat service effectively.