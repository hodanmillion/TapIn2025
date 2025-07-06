package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"auth-service/internal/models"
	"auth-service/internal/services"
	"auth-service/test"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRouter(authHandler *AuthHandler, userHandler *UserHandler, tokenService *services.TokenService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	v1 := router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/verify-email", authHandler.VerifyEmail)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
		}
	}

	return router
}

func TestAuthHandler_Register(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	tests := []struct {
		name           string
		payload        interface{}
		expectedStatus int
		expectUser     bool
	}{
		{
			name: "successful registration",
			payload: models.RegisterRequest{
				Email:    "newuser@example.com",
				Username: "newuser",
				Password: "password123",
			},
			expectedStatus: http.StatusCreated,
			expectUser:     true,
		},
		{
			name: "invalid email",
			payload: models.RegisterRequest{
				Email:    "invalid-email",
				Username: "newuser",
				Password: "password123",
			},
			expectedStatus: http.StatusBadRequest,
			expectUser:     false,
		},
		{
			name: "short password",
			payload: models.RegisterRequest{
				Email:    "test@example.com",
				Username: "newuser",
				Password: "123",
			},
			expectedStatus: http.StatusBadRequest,
			expectUser:     false,
		},
		{
			name: "missing fields",
			payload: map[string]interface{}{
				"email": "test@example.com",
				// missing username and password
			},
			expectedStatus: http.StatusBadRequest,
			expectUser:     false,
		},
		{
			name:           "invalid JSON",
			payload:        "invalid json",
			expectedStatus: http.StatusBadRequest,
			expectUser:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			suite.CleanDatabase(t)

			var body []byte
			var err error

			if str, ok := tt.payload.(string); ok {
				body = []byte(str)
			} else {
				body, err = json.Marshal(tt.payload)
				require.NoError(t, err)
			}

			req, err := http.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectUser {
				var user models.User
				err = json.Unmarshal(w.Body.Bytes(), &user)
				require.NoError(t, err)
				assert.NotZero(t, user.ID)
				assert.NotEmpty(t, user.Email)
				assert.NotEmpty(t, user.Username)
			}
		})
	}
}

func TestAuthHandler_Login(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name           string
		payload        interface{}
		expectedStatus int
		expectToken    bool
	}{
		{
			name: "successful login",
			payload: models.LoginRequest{
				Email:    testUser.Email,
				Password: test.TestData.ValidPassword,
			},
			expectedStatus: http.StatusOK,
			expectToken:    true,
		},
		{
			name: "invalid email",
			payload: models.LoginRequest{
				Email:    "nonexistent@example.com",
				Password: test.TestData.ValidPassword,
			},
			expectedStatus: http.StatusUnauthorized,
			expectToken:    false,
		},
		{
			name: "invalid password",
			payload: models.LoginRequest{
				Email:    testUser.Email,
				Password: "wrongpassword",
			},
			expectedStatus: http.StatusUnauthorized,
			expectToken:    false,
		},
		{
			name: "missing fields",
			payload: map[string]interface{}{
				"email": testUser.Email,
				// missing password
			},
			expectedStatus: http.StatusBadRequest,
			expectToken:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectToken {
				var tokenResponse models.TokenResponse
				err = json.Unmarshal(w.Body.Bytes(), &tokenResponse)
				require.NoError(t, err)
				assert.NotEmpty(t, tokenResponse.AccessToken)
				assert.NotEmpty(t, tokenResponse.RefreshToken)
				assert.NotZero(t, tokenResponse.ExpiresAt)
			}
		})
	}
}

func TestAuthHandler_RefreshToken(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	// Create test user and session
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)
	testSession := suite.CreateTestSession(t, testUser.ID)

	tests := []struct {
		name           string
		refreshToken   string
		expectedStatus int
		expectToken    bool
	}{
		{
			name:           "successful refresh",
			refreshToken:   testSession.RefreshToken,
			expectedStatus: http.StatusOK,
			expectToken:    true,
		},
		{
			name:           "invalid refresh token",
			refreshToken:   "invalid-token",
			expectedStatus: http.StatusUnauthorized,
			expectToken:    false,
		},
		{
			name:           "empty refresh token",
			refreshToken:   "",
			expectedStatus: http.StatusBadRequest,
			expectToken:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := models.RefreshRequest{
				RefreshToken: tt.refreshToken,
			}

			body, err := json.Marshal(payload)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectToken {
				var tokenResponse models.TokenResponse
				err = json.Unmarshal(w.Body.Bytes(), &tokenResponse)
				require.NoError(t, err)
				assert.NotEmpty(t, tokenResponse.AccessToken)
				assert.NotEmpty(t, tokenResponse.RefreshToken)
			}
		})
	}
}

func TestAuthHandler_VerifyEmail(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	// Create unverified user with email token
	emailToken := "test-email-token"
	_, err := suite.DB.Pool().Exec(context.Background(),
		`INSERT INTO users (email, username, password_hash, email_verified, email_token)
		 VALUES ($1, $2, $3, false, $4)`,
		"unverified@example.com", "unverified", "hashedpass", emailToken,
	)
	require.NoError(t, err)

	tests := []struct {
		name           string
		token          string
		expectedStatus int
	}{
		{
			name:           "successful verification",
			token:          emailToken,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid token",
			token:          "invalid-token",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty token",
			token:          "",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/v1/auth/verify-email"
			if tt.token != "" {
				url += "?token=" + tt.token
			}

			req, err := http.NewRequest("POST", url, nil)
			require.NoError(t, err)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestAuthHandler_ForgotPassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name           string
		email          string
		expectedStatus int
	}{
		{
			name:           "existing email",
			email:          testUser.Email,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "non-existing email",
			email:          "nonexistent@example.com",
			expectedStatus: http.StatusOK, // Should still return 200 to prevent enumeration
		},
		{
			name:           "invalid email format",
			email:          "invalid-email",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty email",
			email:          "",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := map[string]string{
				"email": tt.email,
			}

			body, err := json.Marshal(payload)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", "/api/v1/auth/forgot-password", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestAuthHandler_ResetPassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouter(authHandler, userHandler, tokenService)

	// Create user with reset token
	resetToken := "valid-reset-token"
	_, err := suite.DB.Pool().Exec(context.Background(),
		`INSERT INTO users (email, username, password_hash, reset_token, reset_expiry)
		 VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')`,
		"reset@example.com", "resetuser", "oldpasshash", resetToken,
	)
	require.NoError(t, err)

	tests := []struct {
		name           string
		token          string
		password       string
		expectedStatus int
	}{
		{
			name:           "successful reset",
			token:          resetToken,
			password:       "newpassword123",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid token",
			token:          "invalid-token",
			password:       "newpassword123",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "short password",
			token:          resetToken,
			password:       "123",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty token",
			token:          "",
			password:       "newpassword123",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := map[string]string{
				"token":    tt.token,
				"password": tt.password,
			}

			body, err := json.Marshal(payload)
			require.NoError(t, err)

			req, err := http.NewRequest("POST", "/api/v1/auth/reset-password", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}