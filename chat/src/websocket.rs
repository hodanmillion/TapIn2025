use crate::{models::*, AppState};
use axum::extract::ws::{Message as WsMsg, WebSocket};
use futures::{sink::SinkExt, stream::StreamExt};
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

pub async fn handle_socket(socket: WebSocket, location_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = Uuid::new_v4().to_string();
    
    // Channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsMessage>();
    
    // Clone necessary data for tasks
    let socket_id_clone = socket_id.clone();
    let location_id_clone = location_id.clone();
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
                        connections.add_user(location_id_clone.clone(), socket_id_clone.clone(), user);
                        let user_count = connections.get_user_count(&location_id_clone);
                        drop(connections);
                        
                        // Update room activity
                        if let Err(e) = state_clone.db.update_room_activity(&location_id_clone, user_count as i32).await {
                            error!("Failed to update room activity: {}", e);
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
                        // Get user info
                        let connections = state_clone.connections.read().await;
                        if let Some(users) = connections.rooms.get(&location_id_clone) {
                            if let Some(user) = users.get(&socket_id_clone) {
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
    // TODO: Implement actual broadcasting through Redis pub/sub
    // For now, this is a placeholder
    info!("Broadcasting to room {}: {:?}", location_id, message);
}