use crate::{models::*, websocket::*, AppState, AppError};
use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: String,
    pub room_id: String,
    pub user_id: String,
    pub username: String,
    pub content: String,
    pub timestamp: String,
    pub edited_at: Option<String>,
    pub deleted: bool,
    pub reactions: Vec<Reaction>,
}

impl From<Message> for MessageResponse {
    fn from(msg: Message) -> Self {
        MessageResponse {
            id: msg.id.map(|id| id.to_string()).unwrap_or_default(),
            room_id: msg.room_id,
            user_id: msg.user_id,
            username: msg.username,
            content: msg.content,
            timestamp: msg.timestamp.to_rfc3339(),
            edited_at: msg.edited_at.map(|dt| dt.to_rfc3339()),
            deleted: msg.deleted,
            reactions: msg.reactions,
        }
    }
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Path(location_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, location_id, state))
}

pub async fn hex_websocket_handler(
    ws: WebSocketUpgrade,
    Path(h3_index): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_hex_socket(socket, h3_index, state))
}

#[derive(Deserialize)]
pub struct GetMessagesQuery {
    limit: Option<i64>,
    before: Option<DateTime<Utc>>,
}

pub async fn get_messages(
    Path(location_id): Path<String>,
    Query(params): Query<GetMessagesQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<MessageResponse>>, AppError> {
    tracing::info!("GET /api/messages/{} - limit: {:?}, before: {:?}", location_id, params.limit, params.before);
    let limit = params.limit.unwrap_or(50).min(100);
    
    match state.db.get_messages(&location_id, limit, params.before).await {
        Ok(messages) => {
            tracing::info!("Successfully retrieved {} messages for location {}", messages.len(), location_id);
            let responses: Vec<MessageResponse> = messages.into_iter().map(MessageResponse::from).collect();
            Ok(Json(responses))
        },
        Err(e) => {
            tracing::error!("Failed to get messages for location {}: {:?}", location_id, e);
            Err(AppError::DatabaseError(e))
        }
    }
}

#[derive(Deserialize)]
pub struct SendMessageRequest {
    location_id: String,
    user_id: String,
    username: String,
    content: String,
}

pub async fn send_message(
    State(state): State<AppState>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<MessageResponse>, AppError> {
    let mut message = Message {
        id: None,
        room_id: req.location_id,
        user_id: req.user_id,
        username: req.username,
        content: req.content,
        timestamp: Utc::now(),
        edited_at: None,
        deleted: false,
        reactions: vec![],
    };
    
    let id = state.db.create_message(&message).await?;
    message.id = Some(id);
    
    Ok(Json(MessageResponse::from(message)))
}

pub async fn get_room_info(
    Path(location_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ChatRoom>, AppError> {
    let room = state.db.get_or_create_room(&location_id).await?;
    Ok(Json(room))
}

#[derive(Deserialize)]
pub struct JoinRoomRequest {
    user_id: String,
    username: String,
}

#[derive(Serialize)]
pub struct JoinRoomResponse {
    success: bool,
    active_users: i32,
}

pub async fn join_room(
    Path(location_id): Path<String>,
    State(state): State<AppState>,
    Json(_req): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, AppError> {
    let room = state.db.get_or_create_room(&location_id).await?;
    
    Ok(Json(JoinRoomResponse {
        success: true,
        active_users: room.active_users,
    }))
}
