# Chat Service

A real-time location-based chat service built with Rust, WebSockets, and Redis pub/sub for scalable message broadcasting.

## 🏗️ Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CHAT SERVICE (Rust + Axum)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                  PORT 3001                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   HTTP HANDLERS     │    │      WEBSOCKET      │    │     DATA LAYER      │
├─────────────────────┤    │       LAYER         │    ├─────────────────────┤
│                     │    ├─────────────────────┤    │                     │
│ 📨 Message Routes   │───▶│ 🔌 WebSocket        │───▶│ 🗃️ MongoDB          │
│  • GET /messages    │    │  Handler            │    │  • Messages Coll.   │
│  • POST /messages   │    │  • Connection Mgmt  │    │  • Rooms Collection │
│                     │    │  • Message Routing  │    │  • Users Collection │
│ 🏠 Room Routes      │───▶│                     │    │  • Location Indexes │
│  • GET /rooms       │    │ 🔄 Pub/Sub Tasks    │───▶│                     │
│  • POST /join       │    │  • Redis Subscriber │    │ 🔴 Redis Pub/Sub    │
│                     │    │  • Message Sender   │    │  • Room Channels    │
│ 🏥 Health Routes    │───▶│  • Broadcast Logic  │    │  • User Sessions    │
│  • GET /health      │    │                     │    │  • Message Queue    │
│                     │    │ 👥 Connection Mgmt  │───▶│                     │
└─────────────────────┘    │  • User Tracking    │    │ 🌐 External Auth    │
         │                 │  • Room Management  │    │  • Auth Service     │
         ▼                 │  • Session Storage  │    │  • Token Validation │
┌─────────────────────────────────────────────────┘    │                     │
│              WEBSOCKET MESSAGE TYPES                 │                     │
├─────────────────────────────────────────────────────┤                     │
│ 📥 INCOMING (Frontend → Chat)    │ 📤 OUTGOING       │                     │
│  • Auth (user credentials)       │  (Chat → Frontend)│                     │
│  • JoinLocalChat (location)      │  • UserJoined     │                     │
│  • Message (chat content)        │  • UserLeft       │                     │
│                                  │  • RoomJoined     │                     │
│                                  │  • NewMessage     │                     │
│                                  │  • MessageHistory │                     │
│                                  │  • Error          │                     │
└─────────────────────────────────────────────────────┘                     │
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ASYNC TASK ORCHESTRATION                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🔄 Redis Sub Task    │ 📤 Message Send Task  │ 📥 Message Recv Task          │
│  • Per-Socket        │  • WebSocket Output   │  • WebSocket Input            │
│  • Channel Subscribe │  • JSON Serialization │  • Message Parsing            │
│  • Message Forward   │  • Connection Health  │  • Route to Handlers          │
│                      │                       │                               │
│ 🏠 Room Management   │ 💾 Database Tasks     │ 🔐 Auth Integration           │
│  • User Join/Leave   │  • Message Storage    │  • Token Verification         │
│  • Room Creation     │  • Room Persistence   │  • User Context               │
│  • User Counting     │  • Query Execution    │  • Permission Checks          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Function Flow Diagram

### WebSocket Connection Lifecycle
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  CONNECTION │    │    AUTH     │    │  JOIN ROOM  │    │ DISCONNECT  │
│   OPEN      │    │  MESSAGE    │    │   MESSAGE   │    │    CLOSE    │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Create      │    │ Validate    │    │ Find/Create │    │ Remove from │
│ Socket ID   │    │ JWT Token   │    │ Local Room  │    │ Connection  │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    │ Manager     │
      │                  │                  │            └─────┬───────┘
      ▼                  ▼                  ▼                  │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐          ▼
│ Spawn 3     │    │ Create User │    │ Subscribe   │    ┌─────────────┐
│ Async Tasks:│    │ Context     │    │ to Redis    │    │ Broadcast   │
│ • Redis Sub │    └─────┬───────┘    │ Channel     │    │ UserLeft    │
│ • Send      │          │            └─────┬───────┘    │ Event       │
│ • Receive   │          ▼                  │            └─────┬───────┘
└─────┬───────┘    ┌─────────────┐          ▼                  │
      │            │ Send        │    ┌─────────────┐          ▼
      ▼            │ UserJoined  │    │ Add User to │    ┌─────────────┐
┌─────────────┐    │ Event       │    │ Connection  │    │ Clean Up    │
│ Register    │    └─────────────┘    │ Manager     │    │ Resources   │
│ Message     │                      └─────┬───────┘    └─────────────┘
│ Handlers    │                            │
└─────────────┘                            ▼
                                     ┌─────────────┐
                                     │ Send        │
                                     │ RoomJoined  │
                                     │ Response    │
                                     └─────┬───────┘
                                           │
                                           ▼
                                     ┌─────────────┐
                                     │ Send        │
                                     │ Message     │
                                     │ History     │
                                     └─────────────┘
```

### Message Broadcasting Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│USER SENDS   │    │  VALIDATE   │    │  SAVE TO    │    │ BROADCAST   │
│MESSAGE      │    │  & PARSE    │    │  DATABASE   │    │ VIA REDIS   │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Receive     │    │ Check User  │    │ Create      │    │ Create      │
│ WebSocket   │    │ is in Room  │    │ Message     │    │ Broadcast   │
│ JSON        │    └─────┬───────┘    │ Document    │    │ Message     │
└─────┬───────┘          │            └─────┬───────┘    └─────┬───────┘
      │                  ▼                  │                  │
      ▼            ┌─────────────┐          ▼                  ▼
┌─────────────┐    │ Extract     │    ┌─────────────┐    ┌─────────────┐
│ Parse       │    │ User Info   │    │ Insert to   │    │ Publish to  │
│ Message     │    │ from        │    │ MongoDB     │    │ Redis       │
│ Type &      │    │ Connection  │    │ Collection  │    │ Channel     │
│ Content     │    │ Manager     │    └─────┬───────┘    │ "room:{id}" │
└─────┬───────┘    └─────┬───────┘          │            └─────┬───────┘
      │                  │                  ▼                  │
      ▼                  ▼            ┌─────────────┐          ▼
┌─────────────┐    ┌─────────────┐    │ Return      │    ┌─────────────┐
│ Validate    │    │ Create      │    │ Saved       │    │ All Room    │
│ Message     │    │ Message     │    │ Message     │    │ Subscribers │
│ Content     │    │ Object      │    │ with ID     │    │ Receive     │
└─────────────┘    └─────────────┘    └─────────────┘    │ Message     │
                                                         └─────┬───────┘
                                                               │
                                                               ▼
                                                         ┌─────────────┐
                                                         │ Each Socket │
                                                         │ Forwards    │
                                                         │ NewMessage  │
                                                         │ to Frontend │
                                                         └─────────────┘
```

## Architecture Overview

The chat service provides real-time messaging capabilities for location-based chat rooms using:

- **Rust** with Axum for high-performance WebSocket handling
- **Redis Pub/Sub** for scalable message broadcasting across multiple service instances
- **MongoDB** for persistent message storage and room management
- **WebSocket** connections for real-time bidirectional communication with frontend clients

## 🔄 Message Flow Architecture

### Complete Message Push Mechanism: Redis Pub/Sub → Frontend

This documents the exact mechanism used to push messages from Redis pub/sub to the frontend chat interface.

### 1. **Backend: Redis Pub/Sub Publisher**
*File: `src/websocket_pubsub.rs`*

```rust
// When a user sends a message (lines 252-258):
async fn broadcast_to_room(state: &AppState, room_id: &str, message: WsMessage, exclude_socket: Option<&str>) {
    let broadcast_msg = BroadcastMessage {
        from_socket_id: exclude_socket.unwrap_or("").to_string(),
        message,  // This is the WsMessage::NewMessage(saved_message)
    };
    
    // PUBLISHES to Redis channel "room:{room_id}"
    let channel = format!("room:{}", room_id);
    conn.publish(channel, payload).await;
}
```

### 2. **Backend: Redis Pub/Sub Subscriber**
*File: `src/websocket_pubsub.rs`*

```rust
// Each WebSocket connection has a dedicated Redis subscriber task (lines 91-126):
let mut redis_task = tokio::spawn(async move {
    let mut pubsub: PubSub = redis_client.get_async_connection().await?.into_pubsub();
    
    loop {
        match pubsub.on_message().next().await {
            Some(msg) => {
                let broadcast_msg = serde_json::from_str::<BroadcastMessage>(&payload)?;
                
                // Skip self-sent messages
                if broadcast_msg.from_socket_id == socket_id_for_redis {
                    continue;
                }
                
                // FORWARDS to WebSocket client via mpsc channel
                let _ = tx_clone.send(broadcast_msg.message);
            }
        }
    }
});
```

### 3. **Backend: WebSocket Message Sender**
*File: `src/websocket_pubsub.rs`*

```rust
// WebSocket sender task (lines 80-89):
let mut send_task = tokio::spawn(async move {
    while let Some(msg) = rx.recv().await {  // Receives from Redis subscriber
        if let Ok(text) = serde_json::to_string(&msg) {
            // SENDS to frontend via WebSocket
            sender.send(WsMsg::Text(text)).await;
        }
    }
});
```

### 4. **Frontend: WebSocket Message Receiver**
*File: `frontend/src/app/providers/SocketProvider.tsx`*

```typescript
// WebSocket onmessage handler:
socketRef.current.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);  // Receives JSON from backend
    console.log('WebSocket message received:', data);
    
    // CALLS all registered message handlers
    messageHandlersRef.current.forEach(handler => handler(data));
  } catch (error) {
    console.error('Error parsing WebSocket message:', error);
  }
};
```

### 5. **Frontend: React Component Handler**
*File: `frontend/src/features/chat/components/LocalChatInterface.tsx`*

```typescript
// React component registers its handler:
useEffect(() => {
  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'NewMessage':
        // TRANSFORMS backend format to frontend format
        const transformedMessage: Message = {
          id: data._id?.$oid || data._id || data.id,
          timestamp: data.timestamp?.$date?.$numberLong 
            ? new Date(parseInt(data.timestamp.$date.$numberLong)).toISOString()
            : data.timestamp || new Date().toISOString(),
          // ... other transformations
        };
        
        // UPDATES React state, triggers UI re-render
        setMessages(prev => [...prev, transformedMessage]);
        break;
    }
  };

  onMessage(handleMessage);  // REGISTERS handler
  return () => offMessage(handleMessage);  // CLEANUP
}, [onMessage, offMessage]);
```

## 📊 Complete Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   User A sends  │    │   User B sends   │    │   User C sends    │
│     message     │    │     message      │    │     message       │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬─────────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RUST CHAT SERVICE                                │
│                                                                     │
│  ┌─────────────┐     ┌─────────────────────────────────────────┐   │
│  │ WebSocket   │────▶│        broadcast_to_room()              │   │
│  │ Handler     │     │                                         │   │
│  │             │     │ 1. Creates BroadcastMessage             │   │
│  │             │     │ 2. Serializes to JSON                  │   │
│  │             │     │ 3. redis.publish("room:ID", payload)   │   │
│  └─────────────┘     └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────┬───────────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │  REDIS PUB/SUB  │
                                    │                 │
                                    │ Channel:        │
                                    │ "room:{id}"     │
                                    └─────────┬───────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐                 ┌─────────────────┐
│ User A's Socket │                 │ User B's Socket │                 │ User C's Socket │
│                 │                 │                 │                 │                 │
│ Redis Subscriber│                 │ Redis Subscriber│                 │ Redis Subscriber│
│ Task            │                 │ Task            │                 │ Task            │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ mpsc::channel   │                 │ mpsc::channel   │                 │ mpsc::channel   │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ WebSocket Send  │                 │ WebSocket Send  │                 │ WebSocket Send  │
│ Task            │                 │ Task            │                 │ Task            │
└─────────┬───────┘                 └─────────┬───────┘                 └─────────┬───────┘
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐                 ┌─────────────────┐
│ FRONTEND A      │                 │ FRONTEND B      │                 │ FRONTEND C      │
│                 │                 │                 │                 │                 │
│ WebSocket       │                 │ WebSocket       │                 │ WebSocket       │
│ .onmessage      │                 │ .onmessage      │                 │ .onmessage      │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ Message Handler │                 │ Message Handler │                 │ Message Handler │
│ Set             │                 │ Set             │                 │ Set             │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ React Component │                 │ React Component │                 │ React Component │
│ handleMessage() │                 │ handleMessage() │                 │ handleMessage() │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ setMessages()   │                 │ setMessages()   │                 │ setMessages()   │
│       │         │                 │       │         │                 │       │         │
│       ▼         │                 │       ▼         │                 │       ▼         │
│ UI RE-RENDER    │                 │ UI RE-RENDER    │                 │ UI RE-RENDER    │
│ Message appears │                 │ Message appears │                 │ Message appears │
│ in chat         │                 │ in chat         │                 │ in chat         │
└─────────────────┘                 └─────────────────┘                 └─────────────────┘
```

## 🔑 Key Mechanisms

1. **Redis Pub/Sub**: Central message distribution hub
2. **Per-Socket Redis Subscribers**: Each WebSocket connection has its own Redis subscriber task
3. **Async Channel (mpsc)**: Bridges Redis subscriber to WebSocket sender within each backend connection
4. **WebSocket**: Real-time bidirectional communication protocol  
5. **Event-Driven React**: Message handlers registered via useEffect, triggering state updates and UI re-renders

This architecture ensures **real-time message delivery** with **horizontal scalability** - multiple chat service instances can all publish/subscribe to the same Redis channels, enabling seamless multi-server deployment.

## WebSocket Message Types

### Incoming Messages (from Frontend)

- `Auth`: User authentication with token
- `JoinLocalChat`: Join a location-based chat room
- `Message`: Send a chat message

### Outgoing Messages (to Frontend)

- `UserJoined`: Notification when a user joins the room
- `UserLeft`: Notification when a user leaves the room
- `RoomJoined`: Confirmation of successful room join with room details
- `NewMessage`: New chat message from another user
- `MessageHistory`: Historical messages when joining a room
- `Error`: Error messages for failed operations

## Data Format Transformation

The service handles format transformation between MongoDB storage format and frontend expectations:

**MongoDB Format:**
```json
{
  "_id": {"$oid": "..."},
  "timestamp": {"$date": {"$numberLong": "..."}},
  "content": "message text"
}
```

**Frontend Format:**
```json
{
  "id": "...",
  "timestamp": "2025-07-07T12:16:56.782Z",
  "content": "message text"
}
```

## Development

### Running the Service

```bash
cargo run
```

### Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection URL
- `PORT`: Service port (default: 3001)

### Testing

```bash
# Run unit tests
cargo test

# Run integration tests
cargo test --test integration_tests
```

See [README_TESTS.md](./README_TESTS.md) for detailed testing information.

### Monitoring

See [WEBSOCKET_MONITORING.md](./WEBSOCKET_MONITORING.md) for WebSocket traffic monitoring tools.