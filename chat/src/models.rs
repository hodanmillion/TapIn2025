use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub room_id: String,
    pub user_id: String,
    pub username: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub deleted: bool,
    #[serde(default)]
    pub reactions: Vec<Reaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reaction {
    pub user_id: String,
    pub emoji: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRoom {
    #[serde(rename = "_id")]
    pub id: String, // location_id
    pub location_id: String,
    pub active_users: i32,
    pub last_message_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub settings: RoomSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomSettings {
    pub max_users: i32,
    pub rate_limit: i32, // messages per minute
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub socket_id: String,
    pub location_id: String,
}

// WebSocket message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    Join { user_id: String, username: String, token: String },
    Message { content: String },
    Typing { is_typing: bool },
    UserJoined { username: String, timestamp: DateTime<Utc> },
    UserLeft { username: String, timestamp: DateTime<Utc> },
    NewMessage(Message),
    MessageHistory { messages: Vec<Message> },
    Error { message: String },
}