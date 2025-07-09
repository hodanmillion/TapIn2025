use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::{ws::Message, Filter, Rejection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexRoom {
    pub h3_index: String,
    pub resolution: u8,
    pub display_name: Option<String>,
    pub active_users: usize,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexMessage {
    pub id: String,
    pub h3_index: String,
    pub user_id: String,
    pub username: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct HexUser {
    pub id: String,
    pub username: String,
    pub h3_index: String,
    pub joined_at: DateTime<Utc>,
}

// Message types for WebSocket
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum HexWsMessage {
    // Client -> Server
    JoinHex { h3_index: String, user_info: UserInfo },
    LeaveHex { h3_index: String },
    SendMessage { content: String },
    
    // Server -> Client
    HexJoined { 
        hex_info: HexRoom,
        active_users: Vec<String>,
        recent_messages: Vec<HexMessage>
    },
    UserJoinedHex { username: String, user_count: usize },
    UserLeftHex { username: String, user_count: usize },
    NewMessage { message: HexMessage },
    Error { message: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub user_id: String,
    pub username: String,
}

pub type HexRooms = Arc<RwLock<HashMap<String, HexRoom>>>;
pub type HexConnections = Arc<RwLock<HashMap<String, HashMap<String, tokio::sync::mpsc::UnboundedSender<Message>>>>>;

pub struct HexChatService {
    rooms: HexRooms,
    connections: HexConnections,
    redis_client: redis::Client,
    mongo_db: mongodb::Database,
}

impl HexChatService {
    pub fn new(redis_url: &str, mongo_db: mongodb::Database) -> Self {
        let redis_client = redis::Client::open(redis_url)
            .expect("Failed to connect to Redis");
        
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            connections: Arc::new(RwLock::new(HashMap::new())),
            redis_client,
            mongo_db,
        }
    }
    
    pub async fn join_hex(&self, h3_index: String, user: HexUser, tx: tokio::sync::mpsc::UnboundedSender<Message>) -> Result<(), String> {
        // Add user to room
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(h3_index.clone()).or_insert_with(|| HexRoom {
            h3_index: h3_index.clone(),
            resolution: self.extract_resolution(&h3_index),
            display_name: None,
            active_users: 0,
            created_at: Utc::now(),
        });
        
        room.active_users += 1;
        
        // Add connection
        let mut connections = self.connections.write().await;
        let room_connections = connections.entry(h3_index.clone()).or_insert_with(HashMap::new);
        room_connections.insert(user.id.clone(), tx.clone());
        
        // Get room info
        let hex_info = room.clone();
        let active_users: Vec<String> = room_connections.keys().cloned().collect();
        let user_count = active_users.len();
        
        drop(rooms);
        drop(connections);
        
        // Get recent messages from MongoDB
        let recent_messages = self.get_recent_messages(&h3_index, 50).await?;
        
        // Send join confirmation to user
        let join_msg = HexWsMessage::HexJoined {
            hex_info,
            active_users,
            recent_messages,
        };
        
        if let Ok(msg) = serde_json::to_string(&join_msg) {
            let _ = tx.send(Message::text(msg));
        }
        
        // Notify other users in hex
        self.broadcast_to_hex(&h3_index, HexWsMessage::UserJoinedHex {
            username: user.username.clone(),
            user_count,
        }, Some(&user.id)).await;
        
        // Subscribe to Redis channel for this hex
        self.subscribe_to_hex(&h3_index).await?;
        
        Ok(())
    }
    
    pub async fn leave_hex(&self, h3_index: &str, user_id: &str, username: &str) -> Result<(), String> {
        let mut connections = self.connections.write().await;
        
        if let Some(room_connections) = connections.get_mut(h3_index) {
            room_connections.remove(user_id);
            let user_count = room_connections.len();
            
            if room_connections.is_empty() {
                connections.remove(h3_index);
            }
            
            drop(connections);
            
            // Update room user count
            let mut rooms = self.rooms.write().await;
            if let Some(room) = rooms.get_mut(h3_index) {
                room.active_users = room.active_users.saturating_sub(1);
                if room.active_users == 0 {
                    rooms.remove(h3_index);
                }
            }
            drop(rooms);
            
            // Notify remaining users
            self.broadcast_to_hex(h3_index, HexWsMessage::UserLeftHex {
                username: username.to_string(),
                user_count,
            }, Some(user_id)).await;
        }
        
        Ok(())
    }
    
    pub async fn send_message(&self, h3_index: &str, user_id: &str, username: &str, content: String) -> Result<(), String> {
        let message = HexMessage {
            id: Uuid::new_v4().to_string(),
            h3_index: h3_index.to_string(),
            user_id: user_id.to_string(),
            username: username.to_string(),
            content,
            timestamp: Utc::now(),
        };
        
        // Save to MongoDB
        self.save_message(&message).await?;
        
        // Broadcast to all users in hex
        self.broadcast_to_hex(h3_index, HexWsMessage::NewMessage {
            message: message.clone(),
        }, None).await;
        
        // Publish to Redis for other servers
        self.publish_to_redis(h3_index, &message).await?;
        
        Ok(())
    }
    
    async fn broadcast_to_hex(&self, h3_index: &str, message: HexWsMessage, exclude_user: Option<&str>) {
        let connections = self.connections.read().await;
        
        if let Some(room_connections) = connections.get(h3_index) {
            if let Ok(msg) = serde_json::to_string(&message) {
                for (user_id, tx) in room_connections {
                    if exclude_user.map_or(true, |excluded| excluded != user_id) {
                        let _ = tx.send(Message::text(msg.clone()));
                    }
                }
            }
        }
    }
    
    async fn get_recent_messages(&self, h3_index: &str, limit: i64) -> Result<Vec<HexMessage>, String> {
        use mongodb::bson::doc;
        use futures::stream::TryStreamExt;
        
        let collection = self.mongo_db.collection::<HexMessage>("hex_messages");
        
        let cursor = collection
            .find(doc! { "h3_index": h3_index }, None)
            .await
            .map_err(|e| e.to_string())?;
        
        let messages: Vec<HexMessage> = cursor
            .try_collect()
            .await
            .map_err(|e| e.to_string())?;
        
        Ok(messages.into_iter().rev().take(limit as usize).collect())
    }
    
    async fn save_message(&self, message: &HexMessage) -> Result<(), String> {
        let collection = self.mongo_db.collection::<HexMessage>("hex_messages");
        
        collection
            .insert_one(message, None)
            .await
            .map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    async fn subscribe_to_hex(&self, h3_index: &str) -> Result<(), String> {
        // Redis pub/sub subscription for cross-server messaging
        // Implementation depends on Redis async client
        Ok(())
    }
    
    async fn publish_to_redis(&self, h3_index: &str, message: &HexMessage) -> Result<(), String> {
        use redis::AsyncCommands;
        
        let mut conn = self.redis_client
            .get_async_connection()
            .await
            .map_err(|e| e.to_string())?;
        
        let channel = format!("hex:{}", h3_index);
        let msg = serde_json::to_string(message).map_err(|e| e.to_string())?;
        
        conn.publish(channel, msg)
            .await
            .map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    fn extract_resolution(&self, h3_index: &str) -> u8 {
        // In real implementation, would use h3 library
        // For now, default to 8 (neighborhood level)
        8
    }
}

// WebSocket handler
pub fn hex_ws_handler(
    hex_service: Arc<HexChatService>,
) -> impl Filter<Extract = impl warp::Reply, Error = Rejection> + Clone {
    warp::path!("ws" / "hex" / String)
        .and(warp::ws())
        .and(with_hex_service(hex_service))
        .and_then(|h3_index: String, ws: warp::ws::Ws, service| async move {
            Ok::<_, Rejection>(ws.on_upgrade(move |socket| {
                handle_hex_connection(socket, h3_index, service)
            }))
        })
}

fn with_hex_service(
    service: Arc<HexChatService>,
) -> impl Filter<Extract = (Arc<HexChatService>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || service.clone())
}

async fn handle_hex_connection(
    ws: warp::ws::WebSocket,
    h3_index: String,
    service: Arc<HexChatService>,
) {
    // Handle WebSocket connection for hex-based chat
    // Implementation similar to existing WebSocket handler
    // but using hex-based rooms instead of coordinate-based
}