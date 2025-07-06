use axum::{
    extract::{ws::WebSocket, Extension, Path, Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use mongodb::{Client, Database};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{info, error};

use chat_service::{AppState, handlers::*, websocket::*};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let mongodb_uri = std::env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let redis_uri = std::env::var("REDIS_URI")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    
    let app_state = AppState::new(&mongodb_uri, &redis_uri, "chat_app").await?;

    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // WebSocket endpoint
        .route("/ws/:location_id", get(websocket_handler))
        // REST endpoints
        .route("/api/messages/:location_id", get(get_messages))
        .route("/api/messages", post(send_message))
        .route("/api/rooms/:location_id", get(get_room_info))
        .route("/api/rooms/:location_id/join", post(join_room))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("Chat service listening on {}", listener.local_addr()?);
    
    axum::serve(listener, app).await?;

    Ok(())
}