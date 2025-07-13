use axum::{
    extract::{ws::WebSocket, Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use futures::{SinkExt, StreamExt, TryStreamExt};
use mongodb::{bson::doc, Collection};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, error, debug};

use crate::{
    auth::verify_token,
    models::{DirectMessage, WsMessage},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct GetDMMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DirectMessageResponse {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_username: String,
    pub content: String,
    pub timestamp: String,
    pub edited_at: Option<String>,
    pub deleted: bool,
    pub read_by: Vec<String>,
}

impl From<DirectMessage> for DirectMessageResponse {
    fn from(msg: DirectMessage) -> Self {
        DirectMessageResponse {
            id: msg.id.map(|id| id.to_string()).unwrap_or_default(),
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            sender_username: msg.sender_username,
            content: msg.content,
            timestamp: msg.timestamp.to_rfc3339(),
            edited_at: msg.edited_at.map(|dt| dt.to_rfc3339()),
            deleted: msg.deleted,
            read_by: msg.read_by,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DMMessageResponse {
    pub messages: Vec<DirectMessageResponse>,
    pub has_more: bool,
}

pub async fn dm_websocket_handler(
    ws: WebSocketUpgrade,
    Path(conversation_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    info!("DM WebSocket connection request for conversation: {}", conversation_id);
    ws.on_upgrade(move |socket| handle_dm_socket(socket, conversation_id, Arc::new(state)))
}

async fn handle_dm_socket(
    socket: WebSocket,
    conversation_id: String,
    state: Arc<AppState>,
) {
    info!("Handling DM socket for conversation: {}", conversation_id);
    let (mut sender, mut receiver) = socket.split();
    let mut redis = state.redis_pool.get().await.unwrap();
    
    // Channel for this conversation
    let channel = format!("dm:{}", conversation_id);
    
    // Create a separate connection for pubsub
    let pubsub_conn = state.redis.get_async_connection().await.unwrap();
    let mut pubsub = pubsub_conn.into_pubsub();
    pubsub.subscribe(&channel).await.unwrap();
    let mut pubsub_stream = pubsub.into_on_message();
    
    let mut user_id: Option<String> = None;
    let mut username: Option<String> = None;

    // Wait for join message
    if let Some(Ok(msg)) = receiver.next().await {
        if let Ok(text) = msg.to_text() {
            info!("Received message: {}", text);
            match serde_json::from_str::<WsMessage>(text) {
                Ok(ws_msg) => match ws_msg {
                    WsMessage::JoinDM { conversation_id: conv_id, user_id: uid, username: uname, token } => {
                        if conv_id != conversation_id {
                            let _ = sender.send(axum::extract::ws::Message::Text(
                                serde_json::to_string(&WsMessage::Error {
                                    message: "Conversation ID mismatch".to_string(),
                                }).unwrap()
                            )).await;
                            return;
                        }

                        // Verify token and check if user has access to conversation
                        match verify_token(&token) {
                            Ok(claims) => {
                                if claims.user_id != uid {
                                    let _ = sender.send(axum::extract::ws::Message::Text(
                                        serde_json::to_string(&WsMessage::Error {
                                            message: "User ID mismatch".to_string(),
                                        }).unwrap()
                                    )).await;
                                    return;
                                }

                                // Verify user has access to this conversation
                                if !verify_conversation_access(&state, &conversation_id, &uid).await {
                                    let _ = sender.send(axum::extract::ws::Message::Text(
                                        serde_json::to_string(&WsMessage::Error {
                                            message: "Access denied".to_string(),
                                        }).unwrap()
                                    )).await;
                                    return;
                                }

                                user_id = Some(uid);
                                username = Some(uname);
                                
                                // Send joined confirmation
                                let _ = sender.send(axum::extract::ws::Message::Text(
                                    serde_json::to_string(&WsMessage::DMJoined {
                                        conversation_id: conversation_id.clone(),
                                        participant_count: 2, // For now, always 2 for DMs
                                    }).unwrap()
                                )).await;

                                // Send message history
                                let messages = get_dm_messages(&state, &conversation_id, None, Some(50)).await;
                                let _ = sender.send(axum::extract::ws::Message::Text(
                                    serde_json::to_string(&WsMessage::MessageHistory {
                                        messages: messages.into_iter().map(|dm| crate::models::Message {
                                            id: dm.id,
                                            room_id: dm.conversation_id,
                                            user_id: dm.sender_id,
                                            username: dm.sender_username,
                                            content: dm.content,
                                            timestamp: dm.timestamp,
                                            edited_at: dm.edited_at,
                                            deleted: dm.deleted,
                                            reactions: vec![],
                                        }).collect(),
                                    }).unwrap()
                                )).await;
                            }
                            Err(_) => {
                                let _ = sender.send(axum::extract::ws::Message::Text(
                                    serde_json::to_string(&WsMessage::Error {
                                        message: "Invalid token".to_string(),
                                    }).unwrap()
                                )).await;
                                return;
                            }
                        }
                    }
                    _ => {
                        let _ = sender.send(axum::extract::ws::Message::Text(
                            serde_json::to_string(&WsMessage::Error {
                                message: "Expected JoinDM message".to_string(),
                            }).unwrap()
                        )).await;
                        return;
                    }
                },
                Err(e) => {
                    error!("Failed to parse WebSocket message: {}", e);
                    let _ = sender.send(axum::extract::ws::Message::Text(
                        serde_json::to_string(&WsMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        }).unwrap()
                    )).await;
                    return;
                }
            }
        }
    }

    let Some(user_id) = user_id else { return };
    let Some(username) = username else { return };

    // Spawn task to handle incoming Redis messages
    let (redis_tx, mut redis_rx) = tokio::sync::mpsc::channel::<String>(100);
    let redis_task = tokio::spawn(async move {
        while let Some(msg) = pubsub_stream.next().await {
            if let Ok(payload) = msg.get_payload::<String>() {
                let _ = redis_tx.send(payload).await;
            }
        }
    });
    
    // Spawn task to forward Redis messages to WebSocket
    let forward_task = tokio::spawn(async move {
        while let Some(payload) = redis_rx.recv().await {
            let _ = sender.send(axum::extract::ws::Message::Text(payload)).await;
        }
    });

    // Handle incoming WebSocket messages
    while let Some(Ok(msg)) = receiver.next().await {
        if let Ok(text) = msg.to_text() {
            if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(text) {
                match ws_msg {
                    WsMessage::DMMessage { conversation_id: conv_id, content } => {
                        if conv_id != conversation_id {
                            continue;
                        }

                        // Save message to database
                        let message = DirectMessage {
                            id: None,
                            conversation_id: conversation_id.clone(),
                            sender_id: user_id.clone(),
                            sender_username: username.clone(),
                            content: content.clone(),
                            timestamp: Utc::now(),
                            edited_at: None,
                            deleted: false,
                            read_by: vec![user_id.clone()], // Sender has read their own message
                        };

                        if let Ok(saved_msg) = save_dm_message(&state, message).await {
                            // Broadcast to all participants
                            let broadcast_msg = WsMessage::NewMessage(crate::models::Message {
                                id: saved_msg.id,
                                room_id: saved_msg.conversation_id.clone(),
                                user_id: saved_msg.sender_id,
                                username: saved_msg.sender_username,
                                content: saved_msg.content,
                                timestamp: saved_msg.timestamp,
                                edited_at: saved_msg.edited_at,
                                deleted: saved_msg.deleted,
                                reactions: vec![],
                            });

                            let _ = redis.publish::<_, _, ()>(
                                &channel,
                                serde_json::to_string(&broadcast_msg).unwrap()
                            ).await;

                            // Update conversation's last message in user service
                            update_conversation_last_message(&state, &conversation_id, &content, &user_id).await;
                        }
                    }
                    WsMessage::DMTyping { conversation_id: conv_id, is_typing } => {
                        if conv_id != conversation_id {
                            continue;
                        }

                        // Broadcast typing status
                        let typing_msg = WsMessage::Typing { is_typing };
                        let _ = redis.publish::<_, _, ()>(
                            &channel,
                            serde_json::to_string(&typing_msg).unwrap()
                        ).await;
                    }
                    WsMessage::DMRead { conversation_id: conv_id, user_id: uid } => {
                        if conv_id != conversation_id || uid != user_id {
                            continue;
                        }

                        // Mark messages as read
                        mark_messages_as_read(&state, &conversation_id, &user_id).await;
                    }
                    _ => {}
                }
            }
        }
    }

    // Cleanup
    redis_task.abort();
    forward_task.abort();
}

async fn verify_conversation_access(
    _state: &AppState,
    _conversation_id: &str,
    _user_id: &str,
) -> bool {
    // TODO: Call user service to verify access
    // For now, return true (implement actual verification)
    true
}

async fn get_dm_messages(
    state: &AppState,
    conversation_id: &str,
    before: Option<String>,
    limit: Option<i64>,
) -> Vec<DirectMessage> {
    let collection: Collection<DirectMessage> = state.database.collection("direct_messages");
    let limit = limit.unwrap_or(50).min(100) as i64;
    
    let mut filter = doc! {
        "conversation_id": conversation_id,
        "deleted": false,
    };
    
    if let Some(before_id) = before {
        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(&before_id) {
            filter.insert("_id", doc! { "$lt": oid });
        }
    }
    
    let options = mongodb::options::FindOptions::builder()
        .limit(limit)
        .sort(doc! { "_id": -1 })
        .build();
    
    match collection.find(filter, options).await {
        Ok(mut cursor) => {
            let mut messages = Vec::new();
            while let Ok(Some(message)) = cursor.try_next().await {
                messages.push(message);
            }
            messages.reverse(); // Reverse to get chronological order
            messages
        }
        Err(_) => Vec::new(),
    }
}

async fn save_dm_message(
    state: &AppState,
    mut message: DirectMessage,
) -> Result<DirectMessage, mongodb::error::Error> {
    let collection: Collection<DirectMessage> = state.database.collection("direct_messages");
    
    let result = collection.insert_one(&message, None).await?;
    message.id = Some(result.inserted_id.as_object_id().unwrap());
    
    Ok(message)
}

async fn mark_messages_as_read(
    state: &AppState,
    conversation_id: &str,
    user_id: &str,
) {
    let collection: Collection<DirectMessage> = state.database.collection("direct_messages");
    
    let _ = collection.update_many(
        doc! {
            "conversation_id": conversation_id,
            "sender_id": doc! { "$ne": user_id },
            "read_by": doc! { "$ne": user_id },
        },
        doc! {
            "$addToSet": { "read_by": user_id }
        },
        None,
    ).await;
}

async fn update_conversation_last_message(
    _state: &AppState,
    conversation_id: &str,
    _message: &str,
    _sender_id: &str,
) {
    // TODO: Call user service to update conversation's last message
    // This would be an HTTP call to the user service
    // For now, just log it
    info!("Would update conversation {} last message", conversation_id);
}

// REST endpoint to get DM messages
pub async fn get_dm_messages_handler(
    Path(conversation_id): Path<String>,
    Query(query): Query<GetDMMessagesQuery>,
    State(state): State<AppState>,
) -> Result<Json<DMMessageResponse>, StatusCode> {
    let messages = get_dm_messages(&state, &conversation_id, query.before, query.limit).await;
    let has_more = messages.len() == query.limit.unwrap_or(50) as usize;
    
    let message_responses: Vec<DirectMessageResponse> = messages.into_iter()
        .map(DirectMessageResponse::from)
        .collect();
    
    Ok(Json(DMMessageResponse {
        messages: message_responses,
        has_more,
    }))
}