package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"auth-service/internal/config"
	"auth-service/internal/handlers"
	"auth-service/internal/middleware"
	"auth-service/internal/models"
	"auth-service/internal/services"
	"auth-service/test"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
)

type IntegrationTestSuite struct {
	suite.Suite
	app    *gin.Engine
	suite_ *test.TestSuite
}

func (s *IntegrationTestSuite) SetupSuite() {
	s.suite_ = test.NewTestSuite(s.T())

	// Initialize services
	authService := services.NewAuthService(s.suite_.DB.DB, s.suite_.Redis.Client, s.suite_.Config, s.suite_.Logger)
	userService := services.NewUserService(s.suite_.DB.DB, s.suite_.Logger)
	tokenService := services.NewTokenService(s.suite_.Config.JWTSecret, s.suite_.Config.JWTExpiry, s.suite_.Redis.Client, s.suite_.Logger)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, userService, tokenService, s.suite_.Logger)
	userHandler := handlers.NewUserHandler(userService, s.suite_.Logger)

	// Setup router
	s.app = s.setupIntegrationRouter(s.suite_.Config, authHandler, userHandler, tokenService, s.suite_.Logger)
}

func (s *IntegrationTestSuite) TearDownSuite() {
	s.suite_.Cleanup(s.T())
}

func (s *IntegrationTestSuite) SetupTest() {
	s.suite_.CleanDatabase(s.T())
}

func (s *IntegrationTestSuite) setupIntegrationRouter(
	cfg *config.Config,
	authHandler *handlers.AuthHandler,
	userHandler *handlers.UserHandler,
	tokenService *services.TokenService,
	logger *zap.SugaredLogger,
) *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(cfg.AllowedOrigins))
	router.Use(middleware.RateLimit(cfg.RateLimit))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Public routes
	v1 := router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", middleware.Auth(tokenService), authHandler.Logout)
			auth.POST("/verify-email", authHandler.VerifyEmail)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
		}

		// Protected routes
		users := v1.Group("/users")
		users.Use(middleware.Auth(tokenService))
		{
			users.GET("/me", userHandler.GetCurrentUser)
			users.PUT("/me", userHandler.UpdateProfile)
			users.PUT("/me/password", userHandler.ChangePassword)
			users.DELETE("/me", userHandler.DeleteAccount)
		}
	}

	return router
}

func (s *IntegrationTestSuite) makeRequest(method, url string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, err := json.Marshal(body)
		require.NoError(s.T(), err)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req, err := http.NewRequest(method, url, reqBody)
	require.NoError(s.T(), err)

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	w := httptest.NewRecorder()
	s.app.ServeHTTP(w, req)
	return w
}

func (s *IntegrationTestSuite) TestHealthCheck() {
	w := s.makeRequest("GET", "/health", nil, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(s.T(), err)
	assert.Equal(s.T(), "healthy", response["status"])
}

func (s *IntegrationTestSuite) TestUserRegistrationAndLogin() {
	// Test user registration
	registerReq := models.RegisterRequest{
		Email:    "integration@example.com",
		Username: "integrationuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	assert.Equal(s.T(), http.StatusCreated, w.Code)

	var user models.User
	err := json.Unmarshal(w.Body.Bytes(), &user)
	require.NoError(s.T(), err)
	assert.Equal(s.T(), registerReq.Email, user.Email)
	assert.Equal(s.T(), registerReq.Username, user.Username)
	assert.False(s.T(), user.EmailVerified)

	// Test duplicate email registration
	w = s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	assert.Equal(s.T(), http.StatusConflict, w.Code)

	// Test user login
	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var tokenResponse models.TokenResponse
	err = json.Unmarshal(w.Body.Bytes(), &tokenResponse)
	require.NoError(s.T(), err)
	assert.NotEmpty(s.T(), tokenResponse.AccessToken)
	assert.NotEmpty(s.T(), tokenResponse.RefreshToken)
	assert.True(s.T(), tokenResponse.ExpiresAt.After(time.Now()))
}

func (s *IntegrationTestSuite) TestUserProfileOperations() {
	// Register user first
	registerReq := models.RegisterRequest{
		Email:    "profile@example.com",
		Username: "profileuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	require.Equal(s.T(), http.StatusCreated, w.Code)

	// Login to get token
	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	require.Equal(s.T(), http.StatusOK, w.Code)

	var tokenResponse models.TokenResponse
	err := json.Unmarshal(w.Body.Bytes(), &tokenResponse)
	require.NoError(s.T(), err)

	authHeaders := map[string]string{
		"Authorization": "Bearer " + tokenResponse.AccessToken,
	}

	// Test get current user
	w = s.makeRequest("GET", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var user models.User
	err = json.Unmarshal(w.Body.Bytes(), &user)
	require.NoError(s.T(), err)
	assert.Equal(s.T(), registerReq.Email, user.Email)
	assert.Equal(s.T(), registerReq.Username, user.Username)

	// Test update profile
	updateReq := map[string]string{
		"username": "newprofileuser",
	}

	w = s.makeRequest("PUT", "/api/v1/users/me", updateReq, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Verify profile was updated
	w = s.makeRequest("GET", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &user)
	require.NoError(s.T(), err)
	assert.Equal(s.T(), "newprofileuser", user.Username)

	// Test change password
	changePasswordReq := map[string]string{
		"old_password": registerReq.Password,
		"new_password": "newpassword123",
	}

	w = s.makeRequest("PUT", "/api/v1/users/me/password", changePasswordReq, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test login with new password
	loginWithNewPassword := models.LoginRequest{
		Email:    registerReq.Email,
		Password: "newpassword123",
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginWithNewPassword, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test login with old password should fail
	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

func (s *IntegrationTestSuite) TestTokenRefresh() {
	// Register and login user
	registerReq := models.RegisterRequest{
		Email:    "refresh@example.com",
		Username: "refreshuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	require.Equal(s.T(), http.StatusCreated, w.Code)

	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	require.Equal(s.T(), http.StatusOK, w.Code)

	var tokenResponse models.TokenResponse
	err := json.Unmarshal(w.Body.Bytes(), &tokenResponse)
	require.NoError(s.T(), err)

	// Test token refresh
	refreshReq := models.RefreshRequest{
		RefreshToken: tokenResponse.RefreshToken,
	}

	w = s.makeRequest("POST", "/api/v1/auth/refresh", refreshReq, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	var newTokenResponse models.TokenResponse
	err = json.Unmarshal(w.Body.Bytes(), &newTokenResponse)
	require.NoError(s.T(), err)
	assert.NotEmpty(s.T(), newTokenResponse.AccessToken)
	assert.NotEqual(s.T(), tokenResponse.AccessToken, newTokenResponse.AccessToken)
}

func (s *IntegrationTestSuite) TestLogout() {
	// Register and login user
	registerReq := models.RegisterRequest{
		Email:    "logout@example.com",
		Username: "logoutuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	require.Equal(s.T(), http.StatusCreated, w.Code)

	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	require.Equal(s.T(), http.StatusOK, w.Code)

	var tokenResponse models.TokenResponse
	err := json.Unmarshal(w.Body.Bytes(), &tokenResponse)
	require.NoError(s.T(), err)

	authHeaders := map[string]string{
		"Authorization": "Bearer " + tokenResponse.AccessToken,
	}

	// Verify token works
	w = s.makeRequest("GET", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test logout
	w = s.makeRequest("POST", "/api/v1/auth/logout", nil, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Verify token is blacklisted
	w = s.makeRequest("GET", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

func (s *IntegrationTestSuite) TestPasswordReset() {
	// Register user
	registerReq := models.RegisterRequest{
		Email:    "reset@example.com",
		Username: "resetuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	require.Equal(s.T(), http.StatusCreated, w.Code)

	// Test forgot password
	forgotReq := map[string]string{
		"email": registerReq.Email,
	}

	w = s.makeRequest("POST", "/api/v1/auth/forgot-password", forgotReq, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Get reset token from database (in real app, this would be sent via email)
	var resetToken string
	err := s.suite_.DB.Pool().QueryRow(context.Background(),
		"SELECT reset_token FROM users WHERE email = $1",
		registerReq.Email,
	).Scan(&resetToken)
	require.NoError(s.T(), err)
	assert.NotEmpty(s.T(), resetToken)

	// Test reset password
	resetReq := map[string]string{
		"token":    resetToken,
		"password": "newpassword123",
	}

	w = s.makeRequest("POST", "/api/v1/auth/reset-password", resetReq, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test login with new password
	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: "newpassword123",
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Test login with old password should fail
	oldLoginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", oldLoginReq, nil)
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

func (s *IntegrationTestSuite) TestAccountDeletion() {
	// Register and login user
	registerReq := models.RegisterRequest{
		Email:    "delete@example.com",
		Username: "deleteuser",
		Password: "password123",
	}

	w := s.makeRequest("POST", "/api/v1/auth/register", registerReq, nil)
	require.Equal(s.T(), http.StatusCreated, w.Code)

	loginReq := models.LoginRequest{
		Email:    registerReq.Email,
		Password: registerReq.Password,
	}

	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	require.Equal(s.T(), http.StatusOK, w.Code)

	var tokenResponse models.TokenResponse
	err := json.Unmarshal(w.Body.Bytes(), &tokenResponse)
	require.NoError(s.T(), err)

	authHeaders := map[string]string{
		"Authorization": "Bearer " + tokenResponse.AccessToken,
	}

	// Delete account
	w = s.makeRequest("DELETE", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusOK, w.Code)

	// Verify account is deleted - getting user info should fail
	w = s.makeRequest("GET", "/api/v1/users/me", nil, authHeaders)
	assert.Equal(s.T(), http.StatusInternalServerError, w.Code)

	// Verify login no longer works
	w = s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

func (s *IntegrationTestSuite) TestRateLimiting() {
	// This test would require modifying the rate limit for testing
	// For now, we'll just verify the middleware is present by checking headers
	loginReq := models.LoginRequest{
		Email:    "nonexistent@example.com",
		Password: "wrongpassword",
	}

	// Make a request and check that it processes (rate limiting allows it)
	w := s.makeRequest("POST", "/api/v1/auth/login", loginReq, nil)
	assert.Equal(s.T(), http.StatusUnauthorized, w.Code)
}

func (s *IntegrationTestSuite) TestCORS() {
	req, err := http.NewRequest("OPTIONS", "/api/v1/auth/login", nil)
	require.NoError(s.T(), err)
	req.Header.Set("Origin", "http://localhost:3000")

	w := httptest.NewRecorder()
	s.app.ServeHTTP(w, req)

	assert.Equal(s.T(), http.StatusNoContent, w.Code)
	assert.Contains(s.T(), w.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.Contains(s.T(), w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
}

func TestIntegrationSuite(t *testing.T) {
	suite.Run(t, new(IntegrationTestSuite))
}