pub mod models;
pub mod handlers;
pub mod websocket;
pub mod db;
pub mod errors;

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
    pub connections: Arc<RwLock<ConnectionManager>>,
    pub redis: Arc<redis::Client>,
}

impl AppState {
    pub async fn new(mongodb_uri: &str, redis_uri: &str, db_name: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize MongoDB
        let mongo_client = Client::with_uri_str(mongodb_uri).await?;
        let database = mongo_client.database(db_name);
        let mongo_db = Arc::new(MongoDb::new(database));

        // Initialize Redis
        let redis_client = redis::Client::open(redis_uri)?;
        
        // Initialize connection manager
        let connections = Arc::new(RwLock::new(ConnectionManager::new()));

        Ok(AppState {
            db: mongo_db,
            connections,
            redis: Arc::new(redis_client),
        })
    }
}