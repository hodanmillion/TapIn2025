use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::mpsc;
use warp::ws::Message;
use uuid::Uuid;
use chrono::Utc;

use crate::hex_chat::{
    HexChatService, HexRoom, HexMessage, HexUser, HexWsMessage, UserInfo,
    HexRooms, HexConnections
};

// Mock dependencies
struct MockRedisClient;
struct MockMongoDb;

impl MockRedisClient {
    fn new() -> Self {
        MockRedisClient
    }
}

impl MockMongoDb {
    fn new() -> Self {
        MockMongoDb
    }
}

// Helper function to create test service
fn create_test_service() -> HexChatService {
    let redis_client = redis::Client::open("redis://localhost:6379").unwrap();
    let mongo_db = mongodb::Database::new(
        mongodb::Client::with_uri_str("mongodb://localhost:27017")
            .unwrap(),
        "test_db"
    );
    
    HexChatService::new("redis://localhost:6379", mongo_db)
}

#[tokio::test]
async fn test_join_hex_new_room() {
    let service = create_test_service();
    let h3_index = "882a1072cffffff".to_string();
    let user = HexUser {
        id: "user123".to_string(),
        username: "testuser".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Join hex
    let result = service.join_hex(h3_index.clone(), user, tx).await;
    
    assert!(result.is_ok());
    
    // Check room was created
    let rooms = service.rooms.read().await;
    assert!(rooms.contains_key(&h3_index));
    
    let room = rooms.get(&h3_index).unwrap();
    assert_eq!(room.h3_index, h3_index);
    assert_eq!(room.resolution, 8);
    assert_eq!(room.active_users, 1);
    
    // Check connection was added
    let connections = service.connections.read().await;
    assert!(connections.contains_key(&h3_index));
    assert_eq!(connections.get(&h3_index).unwrap().len(), 1);
    
    // Check join message was sent
    if let Ok(msg) = rx.try_recv() {
        if let Message::Text(text) = msg {
            let parsed: HexWsMessage = serde_json::from_str(&text).unwrap();
            match parsed {
                HexWsMessage::HexJoined { hex_info, active_users, .. } => {
                    assert_eq!(hex_info.h3_index, h3_index);
                    assert_eq!(active_users.len(), 1);
                }
                _ => panic!("Expected HexJoined message"),
            }
        }
    }
}

#[tokio::test]
async fn test_join_hex_existing_room() {
    let service = create_test_service();
    let h3_index = "882a1072cffffff".to_string();
    
    // Create initial room
    let user1 = HexUser {
        id: "user1".to_string(),
        username: "user1".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx1, _rx1) = mpsc::unbounded_channel();
    service.join_hex(h3_index.clone(), user1, tx1).await.unwrap();
    
    // Join with second user
    let user2 = HexUser {
        id: "user2".to_string(),
        username: "user2".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx2, _rx2) = mpsc::unbounded_channel();
    let result = service.join_hex(h3_index.clone(), user2, tx2).await;
    
    assert!(result.is_ok());
    
    // Check room has 2 users
    let rooms = service.rooms.read().await;
    let room = rooms.get(&h3_index).unwrap();
    assert_eq!(room.active_users, 2);
    
    // Check connections has 2 users
    let connections = service.connections.read().await;
    assert_eq!(connections.get(&h3_index).unwrap().len(), 2);
}

#[tokio::test]
async fn test_leave_hex() {
    let service = create_test_service();
    let h3_index = "882a1072cffffff".to_string();
    let user_id = "user123".to_string();
    let username = "testuser".to_string();
    
    // First join
    let user = HexUser {
        id: user_id.clone(),
        username: username.clone(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx, _rx) = mpsc::unbounded_channel();
    service.join_hex(h3_index.clone(), user, tx).await.unwrap();
    
    // Verify user is in room
    {
        let rooms = service.rooms.read().await;
        assert_eq!(rooms.get(&h3_index).unwrap().active_users, 1);
        
        let connections = service.connections.read().await;
        assert_eq!(connections.get(&h3_index).unwrap().len(), 1);
    }
    
    // Leave hex
    let result = service.leave_hex(&h3_index, &user_id, &username).await;
    assert!(result.is_ok());
    
    // Check user was removed
    let rooms = service.rooms.read().await;
    assert!(!rooms.contains_key(&h3_index)); // Room should be removed when empty
    
    let connections = service.connections.read().await;
    assert!(!connections.contains_key(&h3_index));
}

#[tokio::test]
async fn test_leave_hex_multiple_users() {
    let service = create_test_service();
    let h3_index = "882a1072cffffff".to_string();
    
    // Add two users
    let user1 = HexUser {
        id: "user1".to_string(),
        username: "user1".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let user2 = HexUser {
        id: "user2".to_string(),
        username: "user2".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx1, _rx1) = mpsc::unbounded_channel();
    let (tx2, _rx2) = mpsc::unbounded_channel();
    
    service.join_hex(h3_index.clone(), user1, tx1).await.unwrap();
    service.join_hex(h3_index.clone(), user2, tx2).await.unwrap();
    
    // Remove one user
    let result = service.leave_hex(&h3_index, "user1", "user1").await;
    assert!(result.is_ok());
    
    // Check room still exists with 1 user
    let rooms = service.rooms.read().await;
    assert!(rooms.contains_key(&h3_index));
    assert_eq!(rooms.get(&h3_index).unwrap().active_users, 1);
    
    let connections = service.connections.read().await;
    assert_eq!(connections.get(&h3_index).unwrap().len(), 1);
}

#[tokio::test]
async fn test_send_message() {
    let service = create_test_service();
    let h3_index = "882a1072cffffff".to_string();
    let user_id = "user123".to_string();
    let username = "testuser".to_string();
    let content = "Hello, neighborhood!".to_string();
    
    // Setup user in room
    let user = HexUser {
        id: user_id.clone(),
        username: username.clone(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx, mut rx) = mpsc::unbounded_channel();
    service.join_hex(h3_index.clone(), user, tx).await.unwrap();
    
    // Clear join message
    rx.try_recv().ok();
    
    // Send message
    let result = service.send_message(&h3_index, &user_id, &username, content.clone()).await;
    assert!(result.is_ok());
    
    // Check message was broadcast
    if let Ok(msg) = rx.try_recv() {
        if let Message::Text(text) = msg {
            let parsed: HexWsMessage = serde_json::from_str(&text).unwrap();
            match parsed {
                HexWsMessage::NewMessage { message } => {
                    assert_eq!(message.h3_index, h3_index);
                    assert_eq!(message.user_id, user_id);
                    assert_eq!(message.username, username);
                    assert_eq!(message.content, content);
                }
                _ => panic!("Expected NewMessage"),
            }
        }
    }
}

#[tokio::test]
async fn test_extract_resolution() {
    let service = create_test_service();
    
    // Test with different H3 indices
    let resolution = service.extract_resolution("882a1072cffffff");
    assert_eq!(resolution, 8); // Default resolution
    
    // In a real implementation, this would parse the actual H3 index
    // For now, we're using a placeholder that returns 8
}

#[tokio::test]
async fn test_hex_ws_message_serialization() {
    // Test serialization of WebSocket messages
    let user_info = UserInfo {
        user_id: "user123".to_string(),
        username: "testuser".to_string(),
    };
    
    let join_msg = HexWsMessage::JoinHex {
        h3_index: "882a1072cffffff".to_string(),
        user_info,
    };
    
    let serialized = serde_json::to_string(&join_msg).unwrap();
    let deserialized: HexWsMessage = serde_json::from_str(&serialized).unwrap();
    
    match deserialized {
        HexWsMessage::JoinHex { h3_index, user_info } => {
            assert_eq!(h3_index, "882a1072cffffff");
            assert_eq!(user_info.user_id, "user123");
            assert_eq!(user_info.username, "testuser");
        }
        _ => panic!("Expected JoinHex message"),
    }
}

#[tokio::test]
async fn test_hex_message_creation() {
    let message = HexMessage {
        id: Uuid::new_v4().to_string(),
        h3_index: "882a1072cffffff".to_string(),
        user_id: "user123".to_string(),
        username: "testuser".to_string(),
        content: "Test message".to_string(),
        timestamp: Utc::now(),
    };
    
    assert_eq!(message.h3_index, "882a1072cffffff");
    assert_eq!(message.user_id, "user123");
    assert_eq!(message.username, "testuser");
    assert_eq!(message.content, "Test message");
    assert!(!message.id.is_empty());
}

#[tokio::test]
async fn test_hex_room_creation() {
    let room = HexRoom {
        h3_index: "882a1072cffffff".to_string(),
        resolution: 8,
        display_name: Some("Test Neighborhood".to_string()),
        active_users: 5,
        created_at: Utc::now(),
    };
    
    assert_eq!(room.h3_index, "882a1072cffffff");
    assert_eq!(room.resolution, 8);
    assert_eq!(room.display_name, Some("Test Neighborhood".to_string()));
    assert_eq!(room.active_users, 5);
}

#[tokio::test]
async fn test_concurrent_joins() {
    let service = Arc::new(create_test_service());
    let h3_index = "882a1072cffffff".to_string();
    
    // Create multiple users joining concurrently
    let mut handles = vec![];
    
    for i in 0..10 {
        let service_clone = service.clone();
        let h3_index_clone = h3_index.clone();
        
        let handle = tokio::spawn(async move {
            let user = HexUser {
                id: format!("user{}", i),
                username: format!("user{}", i),
                h3_index: h3_index_clone.clone(),
                joined_at: Utc::now(),
            };
            
            let (tx, _rx) = mpsc::unbounded_channel();
            service_clone.join_hex(h3_index_clone, user, tx).await
        });
        
        handles.push(handle);
    }
    
    // Wait for all joins to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }
    
    // Check final state
    let rooms = service.rooms.read().await;
    let room = rooms.get(&h3_index).unwrap();
    assert_eq!(room.active_users, 10);
    
    let connections = service.connections.read().await;
    assert_eq!(connections.get(&h3_index).unwrap().len(), 10);
}

// Integration test helper
async fn setup_test_environment() -> HexChatService {
    // In a real integration test, this would:
    // 1. Start Redis container
    // 2. Start MongoDB container
    // 3. Create test database
    // 4. Return service connected to test infrastructure
    
    create_test_service()
}

#[tokio::test]
async fn test_integration_full_flow() {
    let service = setup_test_environment().await;
    let h3_index = "882a1072cffffff".to_string();
    
    // User 1 joins
    let user1 = HexUser {
        id: "user1".to_string(),
        username: "alice".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx1, mut rx1) = mpsc::unbounded_channel();
    service.join_hex(h3_index.clone(), user1, tx1).await.unwrap();
    
    // User 2 joins
    let user2 = HexUser {
        id: "user2".to_string(),
        username: "bob".to_string(),
        h3_index: h3_index.clone(),
        joined_at: Utc::now(),
    };
    
    let (tx2, mut rx2) = mpsc::unbounded_channel();
    service.join_hex(h3_index.clone(), user2, tx2).await.unwrap();
    
    // Clear join messages
    rx1.try_recv().ok();
    rx2.try_recv().ok();
    
    // User 1 sends message
    service.send_message(&h3_index, "user1", "alice", "Hello from Alice!".to_string()).await.unwrap();
    
    // Both users should receive the message
    let msg1 = rx1.try_recv().unwrap();
    let msg2 = rx2.try_recv().unwrap();
    
    // Parse messages
    if let Message::Text(text) = msg1 {
        let parsed: HexWsMessage = serde_json::from_str(&text).unwrap();
        if let HexWsMessage::NewMessage { message } = parsed {
            assert_eq!(message.content, "Hello from Alice!");
            assert_eq!(message.username, "alice");
        }
    }
    
    if let Message::Text(text) = msg2 {
        let parsed: HexWsMessage = serde_json::from_str(&text).unwrap();
        if let HexWsMessage::NewMessage { message } = parsed {
            assert_eq!(message.content, "Hello from Alice!");
            assert_eq!(message.username, "alice");
        }
    }
    
    // User 2 leaves
    service.leave_hex(&h3_index, "user2", "bob").await.unwrap();
    
    // User 1 should receive leave notification
    let leave_msg = rx1.try_recv().unwrap();
    if let Message::Text(text) = leave_msg {
        let parsed: HexWsMessage = serde_json::from_str(&text).unwrap();
        if let HexWsMessage::UserLeftHex { username, user_count } = parsed {
            assert_eq!(username, "bob");
            assert_eq!(user_count, 1);
        }
    }
}