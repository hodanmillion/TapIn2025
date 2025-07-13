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
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
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
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub last_message_at: DateTime<Utc>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
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
    UserJoined { username: String, #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")] timestamp: DateTime<Utc> },
    UserLeft { username: String, #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")] timestamp: DateTime<Utc> },
    NewMessage(Message),
    MessageHistory { messages: Vec<Message> },
    Error { message: String },
    // Local chat specific
    RoomJoined { 
        room_id: String, 
        room_name: String, 
        is_new_room: bool, 
        user_count: i32,
        location: crate::local_chat::Location,
    },
    // Hex chat specific
    JoinHex { h3_index: String, user_info: HexUserInfo },
    HexJoined { h3_index: String, user_count: i32 },
    // DM specific
    JoinDM { conversation_id: String, user_id: String, username: String, token: String },
    DMJoined { conversation_id: String, participant_count: i32 },
    DMMessage { conversation_id: String, content: String },
    DMTyping { conversation_id: String, is_typing: bool },
    DMRead { conversation_id: String, user_id: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HexUserInfo {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_username: String,
    pub content: String,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub edited_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub deleted: bool,
    #[serde(default)]
    pub read_by: Vec<String>, // User IDs who have read this message
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DMConversation {
    #[serde(rename = "_id")]
    pub id: String, // conversation_id from user service
    pub participants: Vec<String>, // User IDs
    pub last_message: Option<DirectMessage>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "mongodb::bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}