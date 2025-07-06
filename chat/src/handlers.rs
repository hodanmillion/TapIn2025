use crate::{models::*, websocket::*, AppState, AppError};
use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Path(location_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, location_id, state))
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
) -> Result<Json<Vec<Message>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let messages = state.db.get_messages(&location_id, limit, params.before).await?;
    Ok(Json(messages))
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
) -> Result<Json<Message>, AppError> {
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
    
    Ok(Json(message))
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
