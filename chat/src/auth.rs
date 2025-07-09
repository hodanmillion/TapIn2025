use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub user_id: String,
    pub email: String,
    pub username: String,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub email: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid authorization token"),
        };
        
        let body = Json(ErrorResponse {
            error: error_message.to_string(),
        });
        
        (status, body).into_response()
    }
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
}

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or(AuthError::MissingToken)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidToken)?;

        // Decode the token
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "your-secret-key-here".to_string());
        let decoding_key = DecodingKey::from_secret(secret.as_bytes());
        
        let token_data = decode::<Claims>(token, &decoding_key, &Validation::default())
            .map_err(|_| AuthError::InvalidToken)?;

        Ok(AuthUser {
            user_id: token_data.claims.user_id,
            email: token_data.claims.email,
            username: token_data.claims.username,
        })
    }
}