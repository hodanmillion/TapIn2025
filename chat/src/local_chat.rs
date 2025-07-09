use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// Local chat specific message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum LocalChatMessage {
    RoomJoined {
        room_id: String,
        room_name: String,
        is_new_room: bool,
        user_count: i32,
        location: Location,
    },
    LocationUpdate {
        user_id: String,
        latitude: f64,
        longitude: f64,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Location {
    #[serde(rename = "type")]
    pub location_type: String,
    pub coordinates: [f64; 2], // [longitude, latitude]
}

impl Location {
    pub fn from_coordinates(latitude: f64, longitude: f64) -> Self {
        Location {
            location_type: "Point".to_string(),
            coordinates: [longitude, latitude], // GeoJSON format
        }
    }
}

pub fn is_local_chat_room(location_id: &str) -> bool {
    // Check if location_id follows the pattern: latitude_longitude
    let parts: Vec<&str> = location_id.split('_').collect();
    if parts.len() == 2 {
        parts[0].parse::<f64>().is_ok() && parts[1].parse::<f64>().is_ok()
    } else {
        false
    }
}

pub fn parse_coordinates_from_location_id(location_id: &str) -> Option<(f64, f64)> {
    let parts: Vec<&str> = location_id.split('_').collect();
    if parts.len() == 2 {
        if let (Ok(lat), Ok(lon)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
            return Some((lat, lon));
        }
    }
    None
}

pub fn generate_room_name(latitude: f64, longitude: f64) -> String {
    // Generate a friendly room name based on coordinates
    // In a real app, this would use reverse geocoding
    format!("Local Chat @ {:.4}, {:.4}", latitude, longitude)
}