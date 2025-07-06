package handlers

import (
	"bytes"
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

func setupTestRouterWithAuth(authHandler *AuthHandler, userHandler *UserHandler, tokenService *services.TokenService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Add middleware to set claims for protected routes
	router.Use(func(c *gin.Context) {
		// For testing, we'll manually set claims if Authorization header is present
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			tokenString := authHeader[7:] // Remove "Bearer "
			claims, err := tokenService.ValidateToken(tokenString)
			if err == nil {
				c.Set("claims", claims)
			}
		}
		c.Next()
	})

	v1 := router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		users := v1.Group("/users")
		{
			users.GET("/me", userHandler.GetCurrentUser)
			users.PUT("/me", userHandler.UpdateProfile)
			users.PUT("/me/password", userHandler.ChangePassword)
			users.DELETE("/me", userHandler.DeleteAccount)
		}
	}

	return router
}

func TestUserHandler_GetCurrentUser(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouterWithAuth(authHandler, userHandler, tokenService)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	// Generate token for user
	token, _, err := tokenService.GenerateToken(testUser.ID, testUser.Email, testUser.Username)
	require.NoError(t, err)

	tests := []struct {
		name           string
		authHeader     string
		expectedStatus int
		expectUser     bool
	}{
		{
			name:           "valid token",
			authHeader:     "Bearer " + token,
			expectedStatus: http.StatusOK,
			expectUser:     true,
		},
		{
			name:           "no auth header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
			expectUser:     false,
		},
		{
			name:           "invalid token",
			authHeader:     "Bearer invalid-token",
			expectedStatus: http.StatusUnauthorized,
			expectUser:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest("GET", "/api/v1/users/me", nil)
			require.NoError(t, err)

			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectUser {
				var user models.User
				err = json.Unmarshal(w.Body.Bytes(), &user)
				require.NoError(t, err)
				assert.Equal(t, testUser.ID, user.ID)
				assert.Equal(t, testUser.Email, user.Email)
				assert.Equal(t, testUser.Username, user.Username)
			}
		})
	}
}

func TestUserHandler_UpdateProfile(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouterWithAuth(authHandler, userHandler, tokenService)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	// Generate token for user
	token, _, err := tokenService.GenerateToken(testUser.ID, testUser.Email, testUser.Username)
	require.NoError(t, err)

	tests := []struct {
		name           string
		authHeader     string
		payload        interface{}
		expectedStatus int
	}{
		{
			name:       "successful update",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"username": "newusername",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:       "no auth header",
			authHeader: "",
			payload: map[string]string{
				"username": "newusername",
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid username - too short",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"username": "ab", // Less than 3 characters
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:       "missing username",
			authHeader: "Bearer " + token,
			payload:    map[string]string{},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req, err := http.NewRequest("PUT", "/api/v1/users/me", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestUserHandler_ChangePassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouterWithAuth(authHandler, userHandler, tokenService)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	// Generate token for user
	token, _, err := tokenService.GenerateToken(testUser.ID, testUser.Email, testUser.Username)
	require.NoError(t, err)

	tests := []struct {
		name           string
		authHeader     string
		payload        interface{}
		expectedStatus int
	}{
		{
			name:       "successful password change",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"old_password": test.TestData.ValidPassword,
				"new_password": "newpassword123",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:       "wrong old password",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"old_password": "wrongpassword",
				"new_password": "newpassword123",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:       "new password too short",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"old_password": test.TestData.ValidPassword,
				"new_password": "123", // Less than 8 characters
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:       "missing old password",
			authHeader: "Bearer " + token,
			payload: map[string]string{
				"new_password": "newpassword123",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:       "no auth header",
			authHeader: "",
			payload: map[string]string{
				"old_password": test.TestData.ValidPassword,
				"new_password": "newpassword123",
			},
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req, err := http.NewRequest("PUT", "/api/v1/users/me/password", bytes.NewBuffer(body))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")

			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestUserHandler_DeleteAccount(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	authService := services.NewAuthService(suite.DB.DB, suite.Redis.Client, suite.Config, suite.Logger)
	tokenService := services.NewTokenService(suite.Config.JWTSecret, suite.Config.JWTExpiry, suite.Redis.Client, suite.Logger)
	userService := services.NewUserService(suite.DB.DB, suite.Logger)

	authHandler := NewAuthHandler(authService, userService, tokenService, suite.Logger)
	userHandler := NewUserHandler(userService, suite.Logger)

	router := setupTestRouterWithAuth(authHandler, userHandler, tokenService)

	tests := []struct {
		name           string
		setupUser      bool
		authHeader     func(token string) string
		expectedStatus int
	}{
		{
			name:      "successful deletion",
			setupUser: true,
			authHeader: func(token string) string {
				return "Bearer " + token
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:      "no auth header",
			setupUser: true,
			authHeader: func(token string) string {
				return ""
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:      "invalid token",
			setupUser: true,
			authHeader: func(token string) string {
				return "Bearer invalid-token"
			},
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			suite.CleanDatabase(t)

			var token string
			if tt.setupUser {
				// Create test user
				testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

				// Generate token for user
				var err error
				token, _, err = tokenService.GenerateToken(testUser.ID, testUser.Email, testUser.Username)
				require.NoError(t, err)
			}

			req, err := http.NewRequest("DELETE", "/api/v1/users/me", nil)
			require.NoError(t, err)

			authHeader := tt.authHeader(token)
			if authHeader != "" {
				req.Header.Set("Authorization", authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				// Verify user was deleted by trying to get current user
				req2, err := http.NewRequest("GET", "/api/v1/users/me", nil)
				require.NoError(t, err)
				req2.Header.Set("Authorization", "Bearer "+token)

				w2 := httptest.NewRecorder()
				router.ServeHTTP(w2, req2)

				// Should fail because user no longer exists
				assert.Equal(t, http.StatusInternalServerError, w2.Code)
			}
		})
	}
}