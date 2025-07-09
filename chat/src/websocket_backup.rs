use crate::{models::*, AppState};
use axum::extract::ws::{Message as WsMsg, WebSocket};
use futures::{sink::SinkExt, stream::StreamExt};
use redis::aio::PubSub;
use redis::AsyncCommands;
use std::collections::HashMap;
use tracing::error;
use uuid::Uuid;

pub struct ConnectionManager {
    // room_id -> HashMap<socket_id, User>
    rooms: HashMap<String, HashMap<String, User>>,
    // socket_id -> room_id mapping for quick lookup
    socket_rooms: HashMap<String, String>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
            socket_rooms: HashMap::new(),
        }
    }

    pub fn add_user(&mut self, room_id: String, socket_id: String, user: User) {
        // Remove user from previous room if they were in one
        if let Some(old_room_id) = self.socket_rooms.get(&socket_id) {
            if let Some(room) = self.rooms.get_mut(old_room_id) {
                room.remove(&socket_id);
            }
        }
        
        // Add to new room
        self.rooms
            .entry(room_id.clone())
            .or_insert_with(HashMap::new)
            .insert(socket_id.clone(), user);
            
        self.socket_rooms.insert(socket_id, room_id);
    }

    pub fn remove_user(&mut self, socket_id: &str) -> Option<(String, User)> {
        if let Some(room_id) = self.socket_rooms.remove(socket_id) {
            if let Some(room) = self.rooms.get_mut(&room_id) {
                if let Some(user) = room.remove(socket_id) {
                    return Some((room_id, user));
                }
            }
        }
        None
    }

    pub fn get_user_count(&self, room_id: &str) -> usize {
        self.rooms
            .get(room_id)
            .map(|room| room.len())
            .unwrap_or(0)
    }
    
    pub fn get_user_room(&self, socket_id: &str) -> Option<&String> {
        self.socket_rooms.get(socket_id)
    }
    
    pub fn get_room_user(&self, room_id: &str, socket_id: &str) -> Option<&User> {
        self.rooms.get(room_id)?.get(socket_id)
    }
}

pub async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = Uuid::new_v4().to_string();
    
    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
    // Channel for Redis subscription commands
    let (redis_cmd_tx, mut redis_cmd_rx) = tokio::sync::mpsc::unbounded_channel::<RedisCommand>();
    
    // Clone necessary data for tasks
    let socket_id_clone = socket_id.clone();
    let state_clone = state.clone();
    
    // Current room tracking for this connection
    let current_room = std::sync::Arc::new(tokio::sync::Mutex::new(None::<String>));
    let current_room_clone = current_room.clone();
    
    // Task to handle outgoing messages
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(WsMsg::Text(text)).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // Task to handle Redis pub/sub messages
    let tx_clone = tx.clone();
    let socket_id_for_redis = socket_id.clone();
    let redis_client = state.redis.clone();
    let mut redis_task = tokio::spawn(async move {
        let mut pubsub: PubSub = match redis_client.get_async_connection().await {
            Ok(conn) => conn.into_pubsub(),
            Err(e) => {
                error!("Failed to create Redis pub/sub connection: {}", e);
                return;
            }
        };
        
        loop {
            tokio::select! {
                Some(cmd) = redis_cmd_rx.recv() => {
                    match cmd {
                        RedisCommand::Subscribe(channel) => {
                            tracing::info!("🔔 Socket {} subscribing to Redis channel: {}", socket_id_for_redis, channel);
                            if let Err(e) = pubsub.subscribe(&channel).await {
                                tracing::error!("❌ Failed to subscribe to {}: {}", channel, e);
                            } else {
                                tracing::info!("✅ Successfully subscribed to {}", channel);
                            }
                        }
                        RedisCommand::Unsubscribe(channel) => {
                            tracing::info!("🔕 Socket {} unsubscribing from Redis channel: {}", socket_id_for_redis, channel);
                            if let Err(e) = pubsub.unsubscribe(&channel).await {
                                tracing::error!("❌ Failed to unsubscribe from {}: {}", channel, e);
                            } else {
                                tracing::info!("✅ Successfully unsubscribed from {}", channel);
                            }
                        }
                    }
                }
                msg = async {
                    pubsub.on_message().next().await
                } => {
                    if let Some(msg) = msg {
                        tracing::info!("📨 Socket {} received Redis message on channel: {}", socket_id_for_redis, msg.get_channel_name());
                        match msg.get_payload::<String>() {
                            Ok(payload) => {
                                tracing::info!("📦 Payload: {}", payload);
                                // Parse the broadcast message
                                if let Ok(broadcast_msg) = serde_json::from_str::<BroadcastMessage>(&payload) {
                                    // Skip if this message is from the current socket
                                    if broadcast_msg.from_socket_id == socket_id_for_redis {
                                        tracing::info!("⏭️ Skipping message from same socket: {}", socket_id_for_redis);
                                        continue;
                                    }
                                    
                                    tracing::info!("📤 Forwarding message to WebSocket client: {:?}", broadcast_msg.message);
                                    // Forward the WebSocket message to the client
                                    let _ = tx_clone.send(broadcast_msg.message);
                                } else {
                                    tracing::error!("❌ Failed to parse broadcast message from payload: {}", payload);
                                }
                            }
                            Err(e) => tracing::error!("❌ Failed to parse Redis message: {}", e),
                        }
                    }
                }
            }
        }
    });
    
    // Task to handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(WsMsg::Text(text))) = receiver.next().await {
            tracing::info!("Received WebSocket message: {}", text);
            if let Ok(msg) = serde_json::from_str::<WsMessage>(&text) {
                tracing::info!("Successfully parsed message: {:?}", msg);
                match msg {
                    WsMessage::Auth { user_id, username, token: _ } => {
                        // Handle authentication message from frontend
                        // TODO: Verify JWT token
                        tracing::info!("User {} ({}) authenticated via WebSocket", username, user_id);
                        
                        // Send authentication success response  
                        let _ = tx.send(WsMessage::UserJoined {
                            username: username.clone(),
                            timestamp: chrono::Utc::now(),
                        });
                    }
                    
                    WsMessage::Join { user_id, username, token: _ } => {
                        // Handle legacy join message 
                        // TODO: Verify JWT token
                        tracing::info!("User {} ({}) authenticated via WebSocket (legacy)", username, user_id);
                        
                        // Send authentication success response
                        let _ = tx.send(WsMessage::UserJoined {
                            username: username.clone(),
                            timestamp: chrono::Utc::now(),
                        });
                    }
                    
                    WsMessage::JoinLocalChat { user_id, username, token: _, latitude, longitude, search_radius } => {
                        // TODO: Verify token
                        
                        let location = GeoJsonPoint::new(longitude, latitude);
                        let search_radius = search_radius.unwrap_or(5000.0);
                        
                        // Find or create local room
                        match state_clone.db.find_or_create_local_room(
                            location.clone(),
                            user_id.clone(),
                            username.clone(),
                            search_radius,
                        ).await {
                            Ok((room, is_new_room)) => {
                                let room_id = room.id.unwrap().to_string();
                                
                                // Unsubscribe from previous room if any
                                let mut current_room_lock = current_room_clone.lock().await;
                                if let Some(old_room) = current_room_lock.take() {
                                    let _ = redis_cmd_tx.send(RedisCommand::Unsubscribe(format!("room:{}", old_room)));
                                }
                                
                                // Subscribe to new room's Redis channel
                                let _ = redis_cmd_tx.send(RedisCommand::Subscribe(format!("room:{}", room_id)));
                                *current_room_lock = Some(room_id.clone());
                                drop(current_room_lock);
                                
                                // Create user object
                                let user = User {
                                    id: user_id.clone(),
                                    username: username.clone(),
                                    socket_id: socket_id_clone.clone(),
                                    current_location: Some(location.clone()),
                                    active_rooms: vec![room_id.clone()],
                                    last_location_update: chrono::Utc::now(),
                                };
                                
                                // Add user to connection manager
                                let mut connections = state_clone.connections.write().await;
                                connections.add_user(room_id.clone(), socket_id_clone.clone(), user.clone());
                                let user_count = connections.get_user_count(&room_id);
                                drop(connections);
                                
                                // Update user location in database
                                let _ = state_clone.db.update_user_location(&user_id, location.clone()).await;
                                
                                // Send room joined response
                                let response = RoomJoinedResponse {
                                    room_id: room_id.clone(),
                                    room_name: room.name.clone(),
                                    is_new_room,
                                    user_count: user_count as i32,
                                    location: location.clone(),
                                };
                                let _ = tx.send(WsMessage::RoomJoined(response));
                                
                                // Send message history
                                if let Ok(messages) = state_clone.db.get_messages(&room_id, 50, None).await {
                                    let _ = tx.send(WsMessage::MessageHistory { messages });
                                }
                                
                                // Broadcast user joined to room
                                broadcast_to_room(
                                    &state_clone,
                                    &room_id,
                                    WsMessage::UserJoined {
                                        username: username.clone(),
                                        timestamp: chrono::Utc::now(),
                                    },
                                    Some(&socket_id_clone),
                                ).await;
                            }
                            Err(e) => {
                                error!("Failed to find/create local room: {}", e);
                                let _ = tx.send(WsMessage::Error {
                                    message: "Failed to join local chat".to_string(),
                                });
                            }
                        }
                    }
                    
                    WsMessage::Message { data } => {
                        // Get user info and room
                        let connections = state_clone.connections.read().await;
                        if let Some(room_id) = connections.get_user_room(&socket_id_clone) {
                            if let Some(user) = connections.get_room_user(room_id, &socket_id_clone) {
                                let message = Message {
                                    id: None,
                                    room_id: room_id.clone(),
                                    user_id: user.id.clone(),
                                    username: user.username.clone(),
                                    content: data.content,
                                    timestamp: chrono::Utc::now(),
                                    edited_at: None,
                                    deleted: false,
                                    reactions: vec![],
                                };
                                
                                let room_id_clone = room_id.clone();
                                drop(connections);
                                
                                // Save to database
                                match state_clone.db.create_message(&message).await {
                                    Ok(id) => {
                                        let mut saved_message = message.clone();
                                        saved_message.id = Some(id);
                                        
                                        // Broadcast to all users in room via Redis
                                        broadcast_to_room(
                                            &state_clone,
                                            &room_id_clone,
                                            WsMessage::NewMessage(saved_message),
                                            Some(&socket_id_clone),
                                        ).await;
                                    }
                                    Err(e) => {
                                        error!("Failed to save message: {}", e);
                                        let _ = tx.send(WsMessage::Error {
                                            message: "Failed to send message".to_string(),
                                        });
                                    }
                                }
                            }
                        }
                        
                    }
                    
                    _ => {
                        tracing::warn!("Unhandled message type: {:?}", msg);
                    }
                }
            } else {
                tracing::error!("Failed to parse WebSocket message: {}", text);
            }
        }
    });
    
    // Wait for any task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
            redis_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
            redis_task.abort();
        },
        _ = (&mut redis_task) => {
            send_task.abort();
            recv_task.abort();
        }
    }
    
    // Clean up on disconnect
    let mut connections = state.connections.write().await;
    if let Some((room_id, user)) = connections.remove_user(&socket_id) {
        drop(connections);
        
        // Remove user from room in database
        let _ = state.db.remove_user_from_room(&room_id, &user.id).await;
        
        // Notify others via Redis
        broadcast_to_room(
            &state,
            &room_id,
            WsMessage::UserLeft {
                username: user.username,
                timestamp: chrono::Utc::now(),
            },
            Some(&socket_id),
        ).await;
    }
}

// Command types for Redis subscription management
enum RedisCommand {
    Subscribe(String),
    Unsubscribe(String),
}

// Broadcast message structure for Redis
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct BroadcastMessage {
    from_socket_id: String,
    message: WsMessage,
}

// Broadcast to room via Redis pub/sub
async fn broadcast_to_room(
    state: &AppState,
    room_id: &str,
    message: WsMessage,
    exclude_socket: Option<&str>,
) {
    tracing::info!("🔄 broadcast_to_room called for room: {}", room_id);
    
    let broadcast_msg = BroadcastMessage {
        from_socket_id: exclude_socket.unwrap_or("").to_string(),
        message: message.clone(),
    };
    
    match serde_json::to_string(&broadcast_msg) {
        Ok(payload) => {
            tracing::info!("✅ Serialized broadcast message: {}", payload);
            
            let mut conn = match state.redis.get_async_connection().await {
                Ok(conn) => {
                    tracing::info!("✅ Got Redis connection");
                    conn
                },
                Err(e) => {
                    tracing::error!("❌ Failed to get Redis connection: {}", e);
                    return;
                }
            };
            
            let channel = format!("room:{}", room_id);
            tracing::info!("📡 Publishing to Redis channel: {}", channel);
            
            match conn.publish::<String, String, usize>(channel.clone(), payload).await {
                Ok(subscriber_count) => {
                    tracing::info!("✅ Successfully published to {}, {} subscribers received", channel, subscriber_count);
                },
                Err(e) => {
                    tracing::error!("❌ Failed to publish to Redis: {}", e);
                }
            }
        },
        Err(e) => {
            tracing::error!("❌ Failed to serialize broadcast message: {}", e);
        }
    }
}