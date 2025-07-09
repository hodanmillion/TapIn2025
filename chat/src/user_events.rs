use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    #[serde(rename = "user:login")]
    UserLogin,
    #[serde(rename = "user:logout")]
    UserLogout,
    #[serde(rename = "user:register")]
    UserRegister,
    #[serde(rename = "user:update")]
    UserUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserEvent {
    #[serde(rename = "type")]
    pub event_type: EventType,
    pub user_id: String,
    pub username: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub data: HashMap<String, serde_json::Value>,
}

pub async fn handle_user_event(event: UserEvent, state: &crate::AppState) {
    match event.event_type {
        EventType::UserLogin => {
            info!("User {} logged in", event.username);
            // Update user online status
            // You could broadcast to all rooms the user is in
        }
        EventType::UserLogout => {
            info!("User {} logged out", event.username);
            // Update user offline status
            // Broadcast to all rooms the user is in
        }
        EventType::UserRegister => {
            info!("New user registered: {}", event.username);
        }
        EventType::UserUpdate => {
            info!("User {} updated their profile", event.username);
            // Could broadcast profile updates to relevant rooms
        }
    }
}

pub async fn subscribe_to_user_events(state: crate::AppState) {
    let redis_client = state.redis.clone();
    
    tokio::spawn(async move {
        let mut pubsub = match redis_client.get_async_connection().await {
            Ok(conn) => conn.into_pubsub(),
            Err(e) => {
                error!("Failed to create Redis connection for user events: {}", e);
                return;
            }
        };
        
        if let Err(e) = pubsub.subscribe("user:events").await {
            error!("Failed to subscribe to user:events channel: {}", e);
            return;
        }
        
        info!("Subscribed to user:events channel");
        
        loop {
            match pubsub.on_message().next().await {
                Some(msg) => {
                    match msg.get_payload::<String>() {
                        Ok(payload) => {
                            match serde_json::from_str::<UserEvent>(&payload) {
                                Ok(event) => {
                                    handle_user_event(event, &state).await;
                                }
                                Err(e) => {
                                    error!("Failed to parse user event: {}", e);
                                }
                            }
                        }
                        Err(e) => error!("Failed to get Redis message payload: {}", e),
                    }
                }
                None => {
                    error!("User events subscription ended");
                    break;
                }
            }
        }
    });
}