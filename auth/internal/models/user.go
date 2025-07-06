package models

import (
    "time"
    "github.com/google/uuid"
)

type User struct {
    ID             uuid.UUID  `db:"id" json:"id"`
    Email          string     `db:"email" json:"email"`
    Username       string     `db:"username" json:"username"`
    PasswordHash   string     `db:"password_hash" json:"-"`
    EmailVerified  bool       `db:"email_verified" json:"email_verified"`
    EmailToken     *string    `db:"email_token" json:"-"`
    ResetToken     *string    `db:"reset_token" json:"-"`
    ResetExpiry    *time.Time `db:"reset_expiry" json:"-"`
    CreatedAt      time.Time  `db:"created_at" json:"created_at"`
    UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
    LastLogin      *time.Time `db:"last_login" json:"last_login"`
}

type Session struct {
    ID           uuid.UUID `db:"id" json:"id"`
    UserID       uuid.UUID `db:"user_id" json:"user_id"`
    RefreshToken string    `db:"refresh_token" json:"refresh_token"`
    UserAgent    string    `db:"user_agent" json:"user_agent"`
    IP           string    `db:"ip" json:"ip"`
    ExpiresAt    time.Time `db:"expires_at" json:"expires_at"`
    CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type RegisterRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Username string `json:"username" binding:"required,min=3,max=50"`
    Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required"`
}

type TokenResponse struct {
    AccessToken  string    `json:"access_token"`
    RefreshToken string    `json:"refresh_token"`
    ExpiresAt    time.Time `json:"expires_at"`
}

type RefreshRequest struct {
    RefreshToken string `json:"refresh_token" binding:"required"`
}