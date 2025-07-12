pub mod models;
pub mod handlers;
pub mod websocket;
pub mod db;
pub mod errors;
pub mod local_chat;
pub mod dm;
pub mod auth;

pub use models::*;
pub use handlers::*;
pub use websocket::*;
pub use db::*;
pub use errors::*;

use mongodb::Client;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<MongoDb>,
    pub database: mongodb::Database,
    pub connections: Arc<RwLock<ConnectionManager>>,
    pub redis: Arc<redis::Client>,
    pub redis_pool: deadpool_redis::Pool,
}

impl AppState {
    pub async fn new(mongodb_uri: &str, redis_uri: &str, db_name: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize MongoDB
        let mongo_client = Client::with_uri_str(mongodb_uri).await?;
        let database = mongo_client.database(db_name);

        // Initialize Redis
        let redis_client = redis::Client::open(redis_uri)?;
        
        // Create Redis pool
        let redis_config = deadpool_redis::Config::from_url(redis_uri);
        let redis_pool = redis_config.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;
        
        // Initialize connection manager
        let connections = Arc::new(RwLock::new(ConnectionManager::new()));

        Ok(AppState {
            db: Arc::new(MongoDb::new(database.clone())),
            database,
            connections,
            redis: Arc::new(redis_client),
            redis_pool,
        })
    }
}