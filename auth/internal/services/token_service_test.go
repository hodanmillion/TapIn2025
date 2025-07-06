package services

import (
	"context"
	"testing"
	"time"

	"auth-service/test"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenService_GenerateToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	tokenService := NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)

	userID := uuid.New()
	email := "test@example.com"
	username := "testuser"

	token, expiresAt, err := tokenService.GenerateToken(userID, email, username)

	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.True(t, expiresAt.After(time.Now()))
	assert.True(t, expiresAt.Before(time.Now().Add(suite.Config.JWTExpiry+time.Minute)))
}

func TestTokenService_ValidateToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	tokenService := NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)

	userID := uuid.New()
	email := "test@example.com"
	username := "testuser"

	// Generate a valid token
	validToken, _, err := tokenService.GenerateToken(userID, email, username)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "valid token",
			token:   validToken,
			wantErr: false,
		},
		{
			name:    "invalid token",
			token:   "invalid.token.here",
			wantErr: true,
		},
		{
			name:    "empty token",
			token:   "",
			wantErr: true,
		},
		{
			name:    "malformed token",
			token:   "malformed",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := tokenService.ValidateToken(tt.token)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, claims)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, claims)
				assert.Equal(t, userID, claims.UserID)
				assert.Equal(t, email, claims.Email)
				assert.Equal(t, username, claims.Username)
				assert.NotEmpty(t, claims.ID)
				assert.True(t, claims.ExpiresAt.After(time.Now()))
			}
		})
	}
}

func TestTokenService_BlacklistToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	tokenService := NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)

	userID := uuid.New()
	email := "test@example.com"
	username := "testuser"

	// Generate a token
	token, expiresAt, err := tokenService.GenerateToken(userID, email, username)
	require.NoError(t, err)

	// Validate token works initially
	claims, err := tokenService.ValidateToken(token)
	require.NoError(t, err)
	assert.NotNil(t, claims)

	// Blacklist the token
	err = tokenService.BlacklistToken(context.Background(), claims.ID, expiresAt)
	require.NoError(t, err)

	// Token should now be invalid
	claims, err = tokenService.ValidateToken(token)
	require.Error(t, err)
	assert.Nil(t, claims)
	assert.Contains(t, err.Error(), "blacklisted")
}

func TestTokenService_ExpiredToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	// Create token service with very short expiry
	shortExpiry := 1 * time.Millisecond
	tokenService := NewTokenService(suite.Config.JWTSecret, shortExpiry, suite.Redis.Client, suite.Logger)

	userID := uuid.New()
	email := "test@example.com"
	username := "testuser"

	// Generate token
	token, _, err := tokenService.GenerateToken(userID, email, username)
	require.NoError(t, err)

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Token should be expired
	claims, err := tokenService.ValidateToken(token)
	require.Error(t, err)
	assert.Nil(t, claims)
}

func TestTokenService_WrongSecret(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	// Create token with one secret
	tokenService1 := NewTokenService("secret1", suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userID := uuid.New()
	email := "test@example.com"
	username := "testuser"

	token, _, err := tokenService1.GenerateToken(userID, email, username)
	require.NoError(t, err)

	// Try to validate with different secret
	tokenService2 := NewTokenService("secret2", suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	claims, err := tokenService2.ValidateToken(token)
	require.Error(t, err)
	assert.Nil(t, claims)
}