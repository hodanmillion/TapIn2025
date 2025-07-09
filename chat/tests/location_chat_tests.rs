use chat_service::{
    db::{MongoDb},
    models::*,
};
use mongodb::{bson::doc, options::ClientOptions, Client};
use std::sync::Arc;
use tokio;

const TEST_DB_NAME: &str = "tap_in_test_location_chat";

async fn setup_test_db() -> Arc<MongoDb> {
    let client_options = ClientOptions::parse("mongodb://localhost:27017").await.unwrap();
    let client = Client::with_options(client_options).unwrap();
    let database = client.database(TEST_DB_NAME);
    
    // Clean up existing test data
    let _ = database.drop(None).await;
    
    let db = Arc::new(MongoDb::new(database));
    
    // Initialize indexes
    db.init_indexes().await.unwrap();
    
    db
}

#[tokio::test]
async fn test_create_room_with_location() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610); // NYC coordinates
    let room = db.create_room(
        "Test Room".to_string(),
        location,
        1000.0, // 1km radius
        "user123".to_string(),
    ).await.unwrap();
    
    assert_eq!(room.name, "Test Room");
    assert_eq!(room.radius, 1000.0);
    assert_eq!(room.created_by, "user123");
    assert_eq!(room.active_users.len(), 1);
    assert_eq!(room.active_users[0], "user123");
}

#[tokio::test]
async fn test_find_nearby_rooms_within_radius() {
    let db = setup_test_db().await;
    
    // Create two rooms close to each other
    let location1 = GeoJsonPoint::new(-73.935242, 40.730610); // NYC
    let location2 = GeoJsonPoint::new(-73.935000, 40.730800); // Very close to location1
    let location3 = GeoJsonPoint::new(-74.006, 40.7128); // Far away (downtown NYC)
    
    db.create_room("Room 1".to_string(), location1.clone(), 1000.0, "user1".to_string()).await.unwrap();
    db.create_room("Room 2".to_string(), location2, 1000.0, "user2".to_string()).await.unwrap();
    db.create_room("Room 3".to_string(), location3, 1000.0, "user3".to_string()).await.unwrap();
    
    // Search for rooms near location1 with 500m radius
    let search_location = GeoJsonPoint::new(-73.935242, 40.730610);
    let nearby_rooms = db.find_nearby_rooms(&search_location, 500.0, 10).await.unwrap();
    
    // Should find Room 1 and Room 2, but not Room 3
    assert_eq!(nearby_rooms.len(), 2);
    assert!(nearby_rooms.iter().any(|r| r.name == "Room 1"));
    assert!(nearby_rooms.iter().any(|r| r.name == "Room 2"));
    assert!(!nearby_rooms.iter().any(|r| r.name == "Room 3"));
}

#[tokio::test]
async fn test_find_or_create_local_room_existing() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    
    // Create an existing room
    let existing_room = db.create_room(
        "Existing Room".to_string(),
        location.clone(),
        1000.0,
        "user1".to_string(),
    ).await.unwrap();
    
    // Try to find or create a room at the same location
    let (found_room, is_new) = db.find_or_create_local_room(
        location,
        "user2".to_string(),
        "user2_name".to_string(),
        1000.0,
    ).await.unwrap();
    
    assert!(!is_new); // Should find existing room
    assert_eq!(found_room.id, existing_room.id);
    assert_eq!(found_room.name, "Existing Room");
}

#[tokio::test]
async fn test_find_or_create_local_room_new() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    
    // Try to find or create a room where none exists
    let (created_room, is_new) = db.find_or_create_local_room(
        location.clone(),
        "user1".to_string(),
        "user1_name".to_string(),
        1000.0,
    ).await.unwrap();
    
    assert!(is_new); // Should create new room
    assert!(created_room.name.contains("40.73"));
    assert!(created_room.name.contains("73.94"));
    assert_eq!(created_room.location.coordinates, location.coordinates);
    assert_eq!(created_room.created_by, "user1");
    assert_eq!(created_room.active_users.len(), 1);
    assert_eq!(created_room.active_users[0], "user1");
}

#[tokio::test]
async fn test_add_user_to_room() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    let room = db.create_room(
        "Test Room".to_string(),
        location,
        1000.0,
        "user1".to_string(),
    ).await.unwrap();
    
    // Add another user to the room
    db.add_user_to_room(&room.id.unwrap().to_hex(), "user2").await.unwrap();
    
    // Verify user was added
    let updated_room = db.rooms
        .find_one(doc! { "_id": room.id.unwrap() }, None)
        .await
        .unwrap()
        .unwrap();
    
    assert_eq!(updated_room.active_users.len(), 2);
    assert!(updated_room.active_users.contains(&"user1".to_string()));
    assert!(updated_room.active_users.contains(&"user2".to_string()));
}

#[tokio::test]
async fn test_remove_user_from_room() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    let room = db.create_room(
        "Test Room".to_string(),
        location,
        1000.0,
        "user1".to_string(),
    ).await.unwrap();
    
    // Add another user
    db.add_user_to_room(&room.id.unwrap().to_hex(), "user2").await.unwrap();
    
    // Remove the first user
    db.remove_user_from_room(&room.id.unwrap().to_hex(), "user1").await.unwrap();
    
    // Verify user was removed
    let updated_room = db.rooms
        .find_one(doc! { "_id": room.id.unwrap() }, None)
        .await
        .unwrap()
        .unwrap();
    
    assert_eq!(updated_room.active_users.len(), 1);
    assert!(!updated_room.active_users.contains(&"user1".to_string()));
    assert!(updated_room.active_users.contains(&"user2".to_string()));
}

#[tokio::test]
async fn test_geojson_point_creation() {
    let point = GeoJsonPoint::new(-73.935242, 40.730610);
    
    assert_eq!(point.geo_type, "Point");
    assert_eq!(point.coordinates[0], -73.935242); // longitude
    assert_eq!(point.coordinates[1], 40.730610);  // latitude
}

#[tokio::test]
async fn test_multiple_rooms_different_locations() {
    let db = setup_test_db().await;
    
    // Create rooms in different cities
    let nyc_location = GeoJsonPoint::new(-73.935242, 40.730610);
    let la_location = GeoJsonPoint::new(-118.2437, 34.0522);
    let chicago_location = GeoJsonPoint::new(-87.6298, 41.8781);
    
    db.create_room("NYC Room".to_string(), nyc_location.clone(), 1000.0, "user1".to_string()).await.unwrap();
    db.create_room("LA Room".to_string(), la_location, 1000.0, "user2".to_string()).await.unwrap();
    db.create_room("Chicago Room".to_string(), chicago_location, 1000.0, "user3".to_string()).await.unwrap();
    
    // Search near NYC - should only find NYC room
    let nearby_nyc = db.find_nearby_rooms(&nyc_location, 50000.0, 10).await.unwrap(); // 50km radius
    
    assert_eq!(nearby_nyc.len(), 1);
    assert_eq!(nearby_nyc[0].name, "NYC Room");
}

#[tokio::test]
async fn test_room_radius_validation() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    
    // Create room with small radius
    let _room1 = db.create_room(
        "Small Radius Room".to_string(),
        location.clone(),
        100.0, // 100m radius
        "user1".to_string(),
    ).await.unwrap();
    
    // Create room with large radius nearby
    let nearby_location = GeoJsonPoint::new(-73.935000, 40.730800); // ~200m away
    let _room2 = db.create_room(
        "Large Radius Room".to_string(),
        nearby_location.clone(),
        1000.0, // 1km radius
        "user2".to_string(),
    ).await.unwrap();
    
    // Search with small radius near first room - should only find room1
    let nearby_small = db.find_nearby_rooms(&location, 150.0, 10).await.unwrap();
    assert_eq!(nearby_small.len(), 1);
    assert_eq!(nearby_small[0].name, "Small Radius Room");
    
    // Search with large radius - should find both
    let nearby_large = db.find_nearby_rooms(&location, 1000.0, 10).await.unwrap();
    assert_eq!(nearby_large.len(), 2);
}

#[tokio::test] 
async fn test_user_location_tracking() {
    let db = setup_test_db().await;
    
    let initial_location = GeoJsonPoint::new(-73.935242, 40.730610);
    let updated_location = GeoJsonPoint::new(-73.936000, 40.731000);
    
    // Update user location
    db.update_user_location("user123", initial_location.clone()).await.unwrap();
    
    // Update to new location
    db.update_user_location("user123", updated_location.clone()).await.unwrap();
    
    // Verify location was updated (this would require a user collection query)
    // For now, just verify the function doesn't error
}

#[tokio::test]
async fn test_edge_case_zero_radius() {
    let db = setup_test_db().await;
    
    let location = GeoJsonPoint::new(-73.935242, 40.730610);
    
    // Search with zero radius - should return empty results
    let rooms = db.find_nearby_rooms(&location, 0.0, 10).await.unwrap();
    assert_eq!(rooms.len(), 0);
}

#[tokio::test]
async fn test_find_nearby_with_limit() {
    let db = setup_test_db().await;
    
    let base_location = GeoJsonPoint::new(-73.935242, 40.730610);
    
    // Create 5 rooms very close to each other
    for i in 0..5 {
        let location = GeoJsonPoint::new(
            -73.935242 + (i as f64 * 0.0001), // Small offset
            40.730610 + (i as f64 * 0.0001)
        );
        db.create_room(
            format!("Room {}", i),
            location,
            1000.0,
            format!("user{}", i),
        ).await.unwrap();
    }
    
    // Search with limit of 3
    let limited_rooms = db.find_nearby_rooms(&base_location, 1000.0, 3).await.unwrap();
    assert_eq!(limited_rooms.len(), 3);
    
    // Search with limit of 10 (should return all 5)
    let all_rooms = db.find_nearby_rooms(&base_location, 1000.0, 10).await.unwrap();
    assert_eq!(all_rooms.len(), 5);
}