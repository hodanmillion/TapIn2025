use crate::models::*;
use chrono::{DateTime, Utc};
use mongodb::{
    bson::{self, doc, oid::ObjectId, Bson},
    error::Result as MongoResult,
    options::{FindOptions, UpdateOptions},
    Collection, Database,
};
use futures::stream::TryStreamExt;

pub struct MongoDb {
    messages: Collection<Message>,
    rooms: Collection<ChatRoom>,
}

impl MongoDb {
    pub fn new(db: Database) -> Self {
        Self {
            messages: db.collection("messages"),
            rooms: db.collection("rooms"),
        }
    }
    
    pub fn database_name(&self) -> String {
        self.messages.namespace().db.clone()
    }

    pub async fn create_message(&self, message: &Message) -> MongoResult<ObjectId> {
        let result = self.messages.insert_one(message, None).await?;
        Ok(result.inserted_id.as_object_id().unwrap())
    }

    pub async fn get_messages(
        &self,
        location_id: &str,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> MongoResult<Vec<Message>> {
        tracing::info!("Getting messages for room: {}, limit: {}", location_id, limit);
        
        let mut filter = doc! { "room_id": location_id };
        
        if let Some(before_time) = before {
            filter.insert("timestamp", doc! { "$lt": Bson::DateTime(mongodb::bson::DateTime::from_millis(before_time.timestamp_millis())) });
        }

        let options = FindOptions::builder()
            .sort(doc! { "timestamp": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.messages.find(filter.clone(), options).await?;
        let mut messages = Vec::new();
        
        while let Some(msg) = cursor.try_next().await? {
            tracing::debug!("Successfully deserialized message: {:?}", msg.id);
            messages.push(msg);
        }
        
        tracing::info!("Retrieved {} messages for room {}", messages.len(), location_id);
        messages.reverse(); // Return in chronological order
        Ok(messages)
    }

    pub async fn get_or_create_room(&self, location_id: &str) -> MongoResult<ChatRoom> {
        let filter = doc! { "_id": location_id };
        
        if let Some(room) = self.rooms.find_one(filter.clone(), None).await? {
            Ok(room)
        } else {
            let new_room = ChatRoom {
                id: location_id.to_string(),
                location_id: location_id.to_string(),
                active_users: 0,
                last_message_at: Utc::now(),
                created_at: Utc::now(),
                settings: RoomSettings {
                    max_users: 1000,
                    rate_limit: 10,
                },
            };
            
            self.rooms.insert_one(&new_room, None).await?;
            Ok(new_room)
        }
    }

    pub async fn update_room_activity(
        &self,
        location_id: &str,
        active_users: i32,
    ) -> MongoResult<()> {
        let filter = doc! { "_id": location_id };
        let update = doc! {
            "$set": {
                "active_users": active_users,
                "last_message_at": Bson::DateTime(mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis())),
            }
        };
        
        let options = UpdateOptions::builder().upsert(true).build();
        self.rooms.update_one(filter, update, options).await?;
        Ok(())
    }

    pub async fn add_reaction(
        &self,
        message_id: &ObjectId,
        user_id: &str,
        emoji: &str,
    ) -> MongoResult<()> {
        let filter = doc! { "_id": message_id };
        let update = doc! {
            "$push": {
                "reactions": {
                    "user_id": user_id,
                    "emoji": emoji,
                }
            }
        };
        
        self.messages.update_one(filter, update, None).await?;
        Ok(())
    }
}