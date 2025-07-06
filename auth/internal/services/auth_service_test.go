package services

import (
	"context"
	"testing"
	"time"

	"auth-service/internal/models"
	"auth-service/test"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthService_Register(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	tests := []struct {
		name    string
		req     *models.RegisterRequest
		wantErr bool
		errType error
	}{
		{
			name: "successful registration",
			req: &models.RegisterRequest{
				Email:    "newuser@example.com",
				Username: "newuser",
				Password: "password123",
			},
			wantErr: false,
		},
		{
			name: "duplicate email",
			req: &models.RegisterRequest{
				Email:    "duplicate@example.com",
				Username: "user1",
				Password: "password123",
			},
			wantErr: true,
			errType: ErrEmailAlreadyExists,
		},
		{
			name: "duplicate username",
			req: &models.RegisterRequest{
				Email:    "user2@example.com",
				Username: "duplicate",
				Password: "password123",
			},
			wantErr: true,
			errType: ErrUsernameAlreadyExists,
		},
	}

	// Create existing user for duplicate tests
	suite.CreateTestUser(t, "duplicate@example.com", "duplicate", "password123")

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := authService.Register(context.Background(), tt.req)

			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.errType, err)
				assert.Nil(t, user)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.req.Email, user.Email)
				assert.Equal(t, tt.req.Username, user.Username)
				assert.False(t, user.EmailVerified) // Should be false initially
				assert.NotZero(t, user.ID)
				assert.NotZero(t, user.CreatedAt)
			}
		})
	}
}

func TestAuthService_Login(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name      string
		req       *models.LoginRequest
		userAgent string
		ip        string
		wantErr   bool
		errType   error
	}{
		{
			name: "successful login",
			req: &models.LoginRequest{
				Email:    test.TestData.ValidEmail,
				Password: test.TestData.ValidPassword,
			},
			userAgent: "test-agent",
			ip:        "127.0.0.1",
			wantErr:   false,
		},
		{
			name: "invalid email",
			req: &models.LoginRequest{
				Email:    "nonexistent@example.com",
				Password: test.TestData.ValidPassword,
			},
			userAgent: "test-agent",
			ip:        "127.0.0.1",
			wantErr:   true,
			errType:   ErrInvalidCredentials,
		},
		{
			name: "invalid password",
			req: &models.LoginRequest{
				Email:    test.TestData.ValidEmail,
				Password: "wrongpassword",
			},
			userAgent: "test-agent",
			ip:        "127.0.0.1",
			wantErr:   true,
			errType:   ErrInvalidCredentials,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, session, err := authService.Login(context.Background(), tt.req, tt.userAgent, tt.ip)

			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.errType, err)
				assert.Nil(t, user)
				assert.Nil(t, session)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, user)
				assert.NotNil(t, session)
				assert.Equal(t, testUser.ID, user.ID)
				assert.Equal(t, testUser.Email, user.Email)
				assert.Equal(t, tt.userAgent, session.UserAgent)
				assert.Equal(t, tt.ip, session.IP)
				assert.NotEmpty(t, session.RefreshToken)
				assert.True(t, session.ExpiresAt.After(time.Now()))
			}
		})
	}
}

func TestAuthService_VerifyEmail(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create unverified user with email token
	emailToken := "test-email-token"
	_, err := suite.DB.Pool().Exec(context.Background(),
		`INSERT INTO users (email, username, password_hash, email_verified, email_token)
		 VALUES ($1, $2, $3, false, $4)`,
		"unverified@example.com", "unverified", "hashedpass", emailToken,
	)
	require.NoError(t, err)

	tests := []struct {
		name    string
		token   string
		wantErr bool
		errType error
	}{
		{
			name:    "successful verification",
			token:   emailToken,
			wantErr: false,
		},
		{
			name:    "invalid token",
			token:   "invalid-token",
			wantErr: true,
			errType: ErrInvalidToken,
		},
		{
			name:    "empty token",
			token:   "",
			wantErr: true,
			errType: ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := authService.VerifyEmail(context.Background(), tt.token)

			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.errType, err)
			} else {
				require.NoError(t, err)

				// Verify user is now verified
				var verified bool
				err = suite.DB.Pool().QueryRow(context.Background(),
					"SELECT email_verified FROM users WHERE email_token IS NULL AND email = $1",
					"unverified@example.com",
				).Scan(&verified)
				require.NoError(t, err)
				assert.True(t, verified)
			}
		})
	}
}

func TestAuthService_ForgotPassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name  string
		email string
	}{
		{
			name:  "existing email",
			email: testUser.Email,
		},
		{
			name:  "non-existing email",
			email: "nonexistent@example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := authService.ForgotPassword(context.Background(), tt.email)
			require.NoError(t, err) // Should always succeed to prevent email enumeration

			if tt.email == testUser.Email {
				// Verify reset token was set
				var resetToken *string
				err = suite.DB.Pool().QueryRow(context.Background(),
					"SELECT reset_token FROM users WHERE email = $1",
					tt.email,
				).Scan(&resetToken)
				require.NoError(t, err)
				assert.NotNil(t, resetToken)
				assert.NotEmpty(t, *resetToken)
			}
		})
	}
}

func TestAuthService_ResetPassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create user with reset token
	resetToken := "valid-reset-token"
	resetExpiry := time.Now().Add(1 * time.Hour)
	_, err := suite.DB.Pool().Exec(context.Background(),
		`INSERT INTO users (email, username, password_hash, reset_token, reset_expiry)
		 VALUES ($1, $2, $3, $4, $5)`,
		"reset@example.com", "resetuser", "oldpasshash", resetToken, resetExpiry,
	)
	require.NoError(t, err)

	tests := []struct {
		name        string
		token       string
		newPassword string
		wantErr     bool
		errType     error
	}{
		{
			name:        "successful reset",
			token:       resetToken,
			newPassword: "newpassword123",
			wantErr:     false,
		},
		{
			name:        "invalid token",
			token:       "invalid-token",
			newPassword: "newpassword123",
			wantErr:     true,
			errType:     ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := authService.ResetPassword(context.Background(), tt.token, tt.newPassword)

			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.errType, err)
			} else {
				require.NoError(t, err)

				// Verify password was changed and reset token cleared
				var passwordHash string
				var resetTokenDB *string
				err = suite.DB.Pool().QueryRow(context.Background(),
					"SELECT password_hash, reset_token FROM users WHERE email = $1",
					"reset@example.com",
				).Scan(&passwordHash, &resetTokenDB)
				require.NoError(t, err)

				// Verify new password works
				err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(tt.newPassword))
				assert.NoError(t, err)

				// Verify reset token was cleared
				assert.Nil(t, resetTokenDB)
			}
		})
	}
}

func TestAuthService_GetSessionByRefreshToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create test user and session
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)
	testSession := suite.CreateTestSession(t, testUser.ID)

	tests := []struct {
		name    string
		token   string
		wantErr bool
		errType error
	}{
		{
			name:    "valid token",
			token:   testSession.RefreshToken,
			wantErr: false,
		},
		{
			name:    "invalid token",
			token:   "invalid-token",
			wantErr: true,
			errType: ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session, err := authService.GetSessionByRefreshToken(context.Background(), tt.token)

			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.errType, err)
				assert.Nil(t, session)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, session)
				assert.Equal(t, testSession.ID, session.ID)
				assert.Equal(t, testSession.UserID, session.UserID)
				assert.Equal(t, testSession.RefreshToken, session.RefreshToken)
			}
		})
	}
}

func TestAuthService_DeleteSession(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create test user and session
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)
	testSession := suite.CreateTestSession(t, testUser.ID)

	// Delete session
	err := authService.DeleteSession(context.Background(), testSession.ID)
	require.NoError(t, err)

	// Verify session was deleted
	_, err = authService.GetSessionByRefreshToken(context.Background(), testSession.RefreshToken)
	assert.Equal(t, ErrInvalidToken, err)
}

func TestAuthService_DeleteAllUserSessions(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)

	// Create test user and multiple sessions
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)
	session1 := suite.CreateTestSession(t, testUser.ID)
	session2 := suite.CreateTestSession(t, testUser.ID)

	// Delete all sessions for user
	err := authService.DeleteAllUserSessions(context.Background(), testUser.ID)
	require.NoError(t, err)

	// Verify all sessions were deleted
	_, err = authService.GetSessionByRefreshToken(context.Background(), session1.RefreshToken)
	assert.Equal(t, ErrInvalidToken, err)

	_, err = authService.GetSessionByRefreshToken(context.Background(), session2.RefreshToken)
	assert.Equal(t, ErrInvalidToken, err)
}