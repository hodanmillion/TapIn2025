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
        self.rooms
            .get(room_id)
            .and_then(|room| room.get(socket_id))
    }
}

pub async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = Uuid::new_v4().to_string();
    
    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
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
    
    // Channel for managing room subscriptions
    let (room_tx, mut room_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    
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
                // Handle new room subscriptions
                room_channel = room_rx.recv() => {
                    if let Some(channel) = room_channel {
                        if let Err(e) = pubsub.subscribe(&channel).await {
                            error!("Failed to subscribe to room channel {}: {}", channel, e);
                        } else {
                            println!("✅ Subscribed to Redis channel: {}", channel);
                        }
                    }
                }
                
                // Handle incoming Redis messages
                _ = async {
                    if let Some(msg) = pubsub.on_message().next().await {
                        match msg.get_payload::<String>() {
                            Ok(payload) => {
                                // Parse the broadcast message
                                if let Ok(broadcast_msg) = serde_json::from_str::<BroadcastMessage>(&payload) {
                                    // Skip if this message is from the current socket
                                    if broadcast_msg.from_socket_id == socket_id_for_redis {
                                        return;
                                    }
                                    
                                    println!("📨 Forwarding Redis message to WebSocket client: {:?}", broadcast_msg.message);
                                    // Forward the WebSocket message to the client
                                    let _ = tx_clone.send(broadcast_msg.message);
                                }
                            }
                            Err(e) => error!("Failed to parse Redis message: {}", e),
                        }
                    }
                } => {}
            }
        }
    });
    
    // Task to handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(WsMsg::Text(text))) = receiver.next().await {
            if let Ok(msg) = serde_json::from_str::<WsMessage>(&text) {
                match msg {
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
                                let channel_name = format!("room:{}", room_id);
                                
                                // Update current room tracking
                                let mut current_room_lock = current_room_clone.lock().await;
                                *current_room_lock = Some(room_id.clone());
                                drop(current_room_lock);
                                
                                // Subscribe to new room's Redis channel via the room subscription channel
                                println!("🔄 Requesting subscription to Redis channel: {}", channel_name);
                                if let Err(e) = room_tx.send(channel_name.clone()) {
                                    error!("Failed to send room subscription request: {}", e);
                                } else {
                                    println!("✅ Room subscription request sent for: {}", channel_name);
                                }
                                
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
    let broadcast_msg = BroadcastMessage {
        from_socket_id: exclude_socket.unwrap_or("").to_string(),
        message: message.clone(),
    };
    
    if let Ok(payload) = serde_json::to_string(&broadcast_msg) {
        let mut conn = match state.redis.get_async_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                error!("Failed to get Redis connection: {}", e);
                return;
            }
        };
        
        let channel = format!("room:{}", room_id);
        println!("📤 Publishing to Redis channel: {} - Message: {:?}", channel, message);
        
        match conn.publish(&channel, &payload).await {
            Ok(subscriber_count) => {
                let count: i32 = subscriber_count;
                println!("✅ Published to {} subscribers on channel: {}", count, channel);
            }
            Err(e) => {
                error!("Failed to publish to Redis channel {}: {}", channel, e);
            }
        }
    } else {
        error!("Failed to serialize broadcast message");
    }
}