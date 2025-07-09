use crate::{models::*, local_chat::*, AppState};
use axum::extract::ws::{Message as WsMsg, WebSocket};
use futures::{sink::SinkExt, stream::StreamExt};
use redis::aio::PubSub;
use redis::AsyncCommands;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tracing::{error, info};
use uuid::Uuid;

pub struct ConnectionManager {
    // location_id -> HashMap<socket_id, User>
    rooms: HashMap<String, HashMap<String, User>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
        }
    }

    pub fn add_user(&mut self, location_id: String, socket_id: String, user: User) {
        self.rooms
            .entry(location_id)
            .or_insert_with(HashMap::new)
            .insert(socket_id, user);
    }

    pub fn remove_user(&mut self, location_id: &str, socket_id: &str) -> Option<User> {
        if let Some(room) = self.rooms.get_mut(location_id) {
            room.remove(socket_id)
        } else {
            None
        }
    }

    pub fn get_room_users(&self, location_id: &str) -> Vec<User> {
        self.rooms
            .get(location_id)
            .map(|room| room.values().cloned().collect())
            .unwrap_or_default()
    }

    pub fn get_user_count(&self, location_id: &str) -> usize {
        self.rooms
            .get(location_id)
            .map(|room| room.len())
            .unwrap_or(0)
    }
}

// Broadcast message structure for Redis pub/sub
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct BroadcastMessage {
    from_socket_id: String,
    message: WsMessage,
}

pub async fn handle_socket(socket: WebSocket, location_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = Uuid::new_v4().to_string();
    
    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
    // Clone necessary data for tasks
    let socket_id_clone = socket_id.clone();
    let location_id_clone = location_id.clone();
    let state_clone = state.clone();
    let tx_clone = tx.clone();
    let socket_id_for_redis = socket_id.clone();
    
    // Create Redis pub/sub connection for this client
    let redis_client = state.redis.clone();
    let channel_name = format!("room:{}", location_id);
    
    // Spawn task to handle Redis pub/sub messages
    let mut redis_task = tokio::spawn(async move {
        let mut pubsub: PubSub = match redis_client.get_async_connection().await {
            Ok(conn) => conn.into_pubsub(),
            Err(e) => {
                error!("Failed to create Redis pub/sub connection: {}", e);
                return;
            }
        };
        
        // Subscribe to room channel
        if let Err(e) = pubsub.subscribe(&channel_name).await {
            error!("Failed to subscribe to channel {}: {}", channel_name, e);
            return;
        }
        
        info!("Socket {} subscribed to Redis channel: {}", socket_id_for_redis, channel_name);
        
        // Listen for messages
        let mut pubsub_stream = pubsub.on_message();
        while let Some(msg) = pubsub_stream.next().await {
            match msg.get_payload::<String>() {
                Ok(payload) => {
                    if let Ok(broadcast_msg) = serde_json::from_str::<BroadcastMessage>(&payload) {
                        // Skip messages from the same socket
                        if broadcast_msg.from_socket_id != socket_id_for_redis {
                            let _ = tx_clone.send(broadcast_msg.message);
                        }
                    }
                }
                Err(e) => error!("Failed to parse Redis message: {}", e),
            }
        }
    });
    
    // Spawn task to forward messages to client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(WsMsg::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(WsMsg::Text(text))) = receiver.next().await {
            if let Ok(msg) = serde_json::from_str::<WsMessage>(&text) {
                match msg {
                    WsMessage::Join { user_id, username, token: _ } => {
                        // TODO: Verify token
                        
                        // Add user to room
                        let user = User {
                            id: user_id.clone(),
                            username: username.clone(),
                            socket_id: socket_id_clone.clone(),
                            location_id: location_id_clone.clone(),
                        };
                        
                        let mut connections = state_clone.connections.write().await;
                        connections.add_user(location_id_clone.clone(), socket_id_clone.clone(), user.clone());
                        let user_count = connections.get_user_count(&location_id_clone);
                        info!("User {} joined room {} (total users: {})", username, location_id_clone, user_count);
                        drop(connections);
                        
                        // Update room activity
                        if let Err(e) = state_clone.db.update_room_activity(&location_id_clone, user_count as i32).await {
                            error!("Failed to update room activity: {}", e);
                        }
                        
                        // Check if this is a local chat room
                        if is_local_chat_room(&location_id_clone) {
                            info!("Detected local chat room: {}", location_id_clone);
                            
                            // Send RoomJoined message for local chat
                            if let Some((lat, lon)) = parse_coordinates_from_location_id(&location_id_clone) {
                                let room_joined_msg = serde_json::json!({
                                    "type": "RoomJoined",
                                    "room_id": location_id_clone,
                                    "room_name": generate_room_name(lat, lon),
                                    "is_new_room": user_count == 1,
                                    "user_count": user_count,
                                    "location": {
                                        "type": "Point",
                                        "coordinates": [lon, lat]
                                    }
                                });
                                
                                // Send via the tx channel which will be forwarded to the client
                                let _ = tx.send(WsMessage::RoomJoined {
                                    room_id: location_id_clone.clone(),
                                    room_name: generate_room_name(lat, lon),
                                    is_new_room: user_count == 1,
                                    user_count: user_count as i32,
                                    location: Location::from_coordinates(lat, lon),
                                });
                            }
                        }
                        
                        // Send message history
                        if let Ok(messages) = state_clone.db.get_messages(&location_id_clone, 50, None).await {
                            let _ = tx.send(WsMessage::MessageHistory { messages });
                        }
                        
                        // Notify others
                        broadcast_to_room(
                            &state_clone,
                            &location_id_clone,
                            WsMessage::UserJoined {
                                username,
                                timestamp: chrono::Utc::now(),
                            },
                            Some(&socket_id_clone),
                        ).await;
                    }
                    
                    WsMessage::Message { content } => {
                        info!("Received message from socket {}: {}", socket_id_clone, content);
                        // Get user info
                        let connections = state_clone.connections.read().await;
                        if let Some(users) = connections.rooms.get(&location_id_clone) {
                            if let Some(user) = users.get(&socket_id_clone) {
                                info!("Found user {} in room {}", user.username, location_id_clone);
                                let message = Message {
                                    id: None,
                                    room_id: location_id_clone.clone(),
                                    user_id: user.id.clone(),
                                    username: user.username.clone(),
                                    content,
                                    timestamp: chrono::Utc::now(),
                                    edited_at: None,
                                    deleted: false,
                                    reactions: vec![],
                                };
                                
                                // Save to database
                                match state_clone.db.create_message(&message).await {
                                    Ok(id) => {
                                        let mut saved_message = message.clone();
                                        saved_message.id = Some(id);
                                        
                                        // Broadcast to all users in room
                                        broadcast_to_room(
                                            &state_clone,
                                            &location_id_clone,
                                            WsMessage::NewMessage(saved_message),
                                            None,
                                        ).await;
                                    }
                                    Err(e) => {
                                        error!("Failed to save message: {}", e);
                                        let _ = tx.send(WsMessage::Error {
                                            message: "Failed to send message".to_string(),
                                        });
                                    }
                                }
                            } else {
                                error!("User {} not found in room {}", socket_id_clone, location_id_clone);
                            }
                        } else {
                            error!("Room {} not found in connections", location_id_clone);
                        }
                    }
                    
                    _ => {}
                }
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
    if let Some(user) = connections.remove_user(&location_id, &socket_id) {
        let user_count = connections.get_user_count(&location_id);
        drop(connections);
        
        // Update room activity
        let _ = state.db.update_room_activity(&location_id, user_count as i32).await;
        
        // Notify others
        broadcast_to_room(
            &state,
            &location_id,
            WsMessage::UserLeft {
                username: user.username,
                timestamp: chrono::Utc::now(),
            },
            Some(&socket_id),
        ).await;
    }
}

async fn broadcast_to_room(
    state: &AppState,
    location_id: &str,
    message: WsMessage,
    exclude_socket: Option<&str>,
) {
    let channel = format!("room:{}", location_id);
    let broadcast_msg = BroadcastMessage {
        from_socket_id: exclude_socket.unwrap_or("").to_string(),
        message,
    };
    
    if let Ok(payload) = serde_json::to_string(&broadcast_msg) {
        match state.redis.get_async_connection().await {
            Ok(mut conn) => {
                match conn.publish::<_, _, ()>(&channel, &payload).await {
                    Ok(_) => {
                        info!("Published message to Redis channel: {}", channel);
                    }
                    Err(e) => {
                        error!("Failed to publish to Redis channel {}: {}", channel, e);
                    }
                }
            }
            Err(e) => {
                error!("Failed to get Redis connection for broadcasting: {}", e);
            }
        }
    } else {
        error!("Failed to serialize broadcast message");
    }
}