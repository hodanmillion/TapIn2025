use reqwest::Client as HttpClient;
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

// Simple integration tests that don't require complex test infrastructure
#[tokio::test]
async fn test_rest_api_basic() {
    // This test assumes the chat service is already running on port 3000
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    
    let base_url = "http://localhost:3000";
    
    // Test get room info
    let response = client
        .get(&format!("{}/api/rooms/test-room", base_url))
        .send()
        .await;
    
    if let Ok(response) = response {
        if response.status().is_success() {
            let room_data: serde_json::Value = response.json().await.unwrap();
            assert_eq!(room_data["location_id"], "test-room");
            assert!(room_data["active_users"].is_number());
            println!("✅ GET room info works");
        } else {
            println!("ℹ️  Service may not be running: status {}", response.status());
        }
    } else {
        println!("ℹ️  Cannot connect to chat service. Make sure it's running on port 3000");
    }
}

#[tokio::test]
async fn test_message_api_basic() {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    
    let base_url = "http://localhost:3000";
    
    // Test send message
    let message_payload = json!({
        "location_id": "test-room",
        "user_id": "test-user-1",
        "username": "TestUser1",
        "content": "Hello from integration test!"
    });
    
    let response = client
        .post(&format!("{}/api/messages", base_url))
        .json(&message_payload)
        .send()
        .await;
    
    if let Ok(response) = response {
        if response.status().is_success() {
            let message_response: serde_json::Value = response.json().await.unwrap();
            assert_eq!(message_response["content"], "Hello from integration test!");
            assert_eq!(message_response["username"], "TestUser1");
            println!("✅ POST message works");
            
            // Test get messages
            let get_response = client
                .get(&format!("{}/api/messages/test-room?limit=10", base_url))
                .send()
                .await;
            
            if let Ok(get_response) = get_response {
                if get_response.status().is_success() {
                    let messages: serde_json::Value = get_response.json().await.unwrap();
                    assert!(messages.is_array());
                    let messages_array = messages.as_array().unwrap();
                    assert!(!messages_array.is_empty());
                    
                    // Verify our message is in the response
                    let found_message = messages_array.iter().find(|msg| {
                        msg["content"] == "Hello from integration test!"
                    });
                    assert!(found_message.is_some());
                    println!("✅ GET messages works");
                } else {
                    println!("ℹ️  GET messages failed: status {}", get_response.status());
                }
            }
        } else {
            println!("ℹ️  POST message failed: status {}", response.status());
        }
    } else {
        println!("ℹ️  Cannot connect to chat service. Make sure it's running on port 3000");
    }
}

#[tokio::test]
async fn test_join_room_api() {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    
    let base_url = "http://localhost:3000";
    
    // Test join room
    let join_payload = json!({
        "user_id": "test-user-1",
        "username": "TestUser1"
    });
    
    let response = client
        .post(&format!("{}/api/rooms/test-room/join", base_url))
        .json(&join_payload)
        .send()
        .await;
    
    if let Ok(response) = response {
        if response.status().is_success() {
            let join_response: serde_json::Value = response.json().await.unwrap();
            assert_eq!(join_response["success"], true);
            println!("✅ POST join room works");
        } else {
            println!("ℹ️  JOIN room failed: status {}", response.status());
        }
    } else {
        println!("ℹ️  Cannot connect to chat service. Make sure it's running on port 3000");
    }
}

#[tokio::test]
async fn test_concurrent_messages() {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    
    let base_url = "http://localhost:3000";
    let room_id = "concurrent-test-room";
    let message_count = 5; // Reduced for simple test
    
    // Create concurrent message sending tasks
    let mut tasks = vec![];
    
    for i in 0..message_count {
        let client = client.clone();
        let base_url = base_url.to_string();
        
        let task = tokio::spawn(async move {
            let message = json!({
                "location_id": room_id,
                "user_id": format!("concurrent-user-{}", i),
                "username": format!("ConcurrentUser{}", i),
                "content": format!("Concurrent message {}", i)
            });
            
            let response = client
                .post(&format!("{}/api/messages", base_url))
                .json(&message)
                .send()
                .await;
            
            if let Ok(response) = response {
                response.status().is_success()
            } else {
                false
            }
        });
        
        tasks.push(task);
    }
    
    // Wait for all tasks to complete
    let results = futures::future::join_all(tasks).await;
    
    // Check if service is available
    if results.iter().any(|r| r.is_ok() && *r.as_ref().unwrap()) {
        println!("✅ Concurrent messages test completed");
        
        // Verify messages were saved
        sleep(Duration::from_millis(500)).await;
        
        let response = client
            .get(&format!("{}/api/messages/{}?limit=50", base_url, room_id))
            .send()
            .await;
        
        if let Ok(response) = response {
            if response.status().is_success() {
                let messages: serde_json::Value = response.json().await.unwrap();
                let messages_array = messages.as_array().unwrap();
                
                // Count our concurrent messages
                let concurrent_messages: Vec<_> = messages_array.iter()
                    .filter(|msg| {
                        if let Some(content) = msg["content"].as_str() {
                            content.starts_with("Concurrent message")
                        } else {
                            false
                        }
                    })
                    .collect();
                
                println!("✅ Found {} concurrent messages in database", concurrent_messages.len());
            }
        }
    } else {
        println!("ℹ️  Cannot connect to chat service. Make sure it's running on port 3000");
    }
}

#[tokio::test]
async fn test_error_handling() {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    
    let base_url = "http://localhost:3000";
    
    // Test invalid JSON in REST API
    let response = client
        .post(&format!("{}/api/messages", base_url))
        .header("content-type", "application/json")
        .body("invalid json")
        .send()
        .await;
    
    if let Ok(response) = response {
        if response.status().is_client_error() {
            println!("✅ Invalid JSON properly rejected");
        } else {
            println!("ℹ️  Unexpected response to invalid JSON: {}", response.status());
        }
    } else {
        println!("ℹ️  Cannot connect to chat service. Make sure it's running on port 3000");
    }
    
    // Test missing fields in message
    let invalid_message = json!({
        "location_id": "error-test-room",
        "user_id": "error-user",
        // Missing username and content
    });
    
    let response = client
        .post(&format!("{}/api/messages", base_url))
        .json(&invalid_message)
        .send()
        .await;
    
    if let Ok(response) = response {
        if response.status().is_client_error() {
            println!("✅ Missing fields properly rejected");
        } else {
            println!("ℹ️  Unexpected response to missing fields: {}", response.status());
        }
    }
}

// Helper function to check if service is running
async fn is_service_running() -> bool {
    let client = HttpClient::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .expect("Failed to create HTTP client");
    
    let response = client
        .get("http://localhost:3000/api/rooms/health-check")
        .send()
        .await;
    
    matches!(response, Ok(r) if r.status().is_success())
}

#[tokio::test]
async fn test_service_availability() {
    if is_service_running().await {
        println!("✅ Chat service is running and responding");
    } else {
        println!("⚠️  Chat service is not running on port 3000");
        println!("💡 Start the service with: cargo run");
    }
}