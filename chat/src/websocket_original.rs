use crate::{models::*, AppState};
use axum::extract::ws::{Message as WsMsg, WebSocket};
use futures::{sink::SinkExt, stream::StreamExt};
use std::collections::HashMap;
use tracing::{error, info};
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

    pub fn get_room_users(&self, room_id: &str) -> Vec<User> {
        self.rooms
            .get(room_id)
            .map(|room| room.values().cloned().collect())
            .unwrap_or_default()
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
}

pub async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = Uuid::new_v4().to_string();
    
    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
    // Clone necessary data for tasks
    let socket_id_clone = socket_id.clone();
    let state_clone = state.clone();
    
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
                    WsMessage::JoinLocalChat(req) => {
                        // TODO: Verify token
                        
                        let location = GeoJsonPoint::new(req.longitude, req.latitude);
                        let search_radius = req.search_radius.unwrap_or(5000.0);
                        
                        // Find or create local room
                        match state_clone.db.find_or_create_local_room(
                            location.clone(),
                            req.user_id.clone(),
                            req.username.clone(),
                            search_radius,
                        ).await {
                            Ok((room, is_new_room)) => {
                                let room_id = room.id.unwrap().to_string();
                                
                                // Create user object
                                let user = User {
                                    id: req.user_id.clone(),
                                    username: req.username.clone(),
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
                                let _ = state_clone.db.update_user_location(&req.user_id, location.clone()).await;
                                
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
                                
                                // Notify others in room
                                broadcast_to_room(
                                    &state_clone,
                                    &room_id,
                                    WsMessage::UserJoined {
                                        username: req.username,
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
                    
                    WsMessage::LocationUpdate(req) => {
                        let location = GeoJsonPoint::new(req.longitude, req.latitude);
                        
                        // Update user location in database
                        if let Err(e) = state_clone.db.update_user_location(&req.user_id, location.clone()).await {
                            error!("Failed to update user location: {}", e);
                        }
                        
                        // Update in connection manager
                        let mut connections = state_clone.connections.write().await;
                        if let Some(room_id) = connections.get_user_room(&socket_id_clone).cloned() {
                            if let Some(room) = connections.rooms.get_mut(&room_id) {
                                if let Some(user) = room.get_mut(&socket_id_clone) {
                                    user.current_location = Some(location);
                                    user.last_location_update = chrono::Utc::now();
                                }
                            }
                        }
                    }
                    
                    WsMessage::Message { content } => {
                        // Get user info and room
                        let connections = state_clone.connections.read().await;
                        if let Some(room_id) = connections.get_user_room(&socket_id_clone) {
                            if let Some(room) = connections.rooms.get(room_id) {
                                if let Some(user) = room.get(&socket_id_clone) {
                                    let message = Message {
                                        id: None,
                                        room_id: room_id.clone(),
                                        user_id: user.id.clone(),
                                        username: user.username.clone(),
                                        content,
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
                                            
                                            // Broadcast to all users in room
                                            broadcast_to_room(
                                                &state_clone,
                                                &room_id_clone,
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
                                }
                            }
                        }
                    }
                    
                    _ => {}
                }
            }
        }
    });
    
    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
    
    // Clean up on disconnect
    let mut connections = state.connections.write().await;
    if let Some((room_id, user)) = connections.remove_user(&socket_id) {
        let _user_count = connections.get_user_count(&room_id);
        drop(connections);
        
        // Remove user from room in database
        let _ = state.db.remove_user_from_room(&room_id, &user.id).await;
        
        // Notify others
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

async fn broadcast_to_room(
    _state: &AppState,
    room_id: &str,
    message: WsMessage,
    _exclude_socket: Option<&str>,
) {
    // TODO: Implement actual broadcasting through Redis pub/sub
    // For now, this is a placeholder that logs the broadcast
    info!("Broadcasting to room {}: {:?}", room_id, message);
    
    // In a full implementation, you would:
    // 1. Get all connected sockets for this room
    // 2. Send the message to each socket except the excluded one
    // 3. Handle Redis pub/sub for multi-server scenarios
}