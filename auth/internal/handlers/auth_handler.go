package handlers

import (
    "net/http"

    "auth-service/internal/models"
    "auth-service/internal/services"

    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
)

type AuthHandler struct {
    authService  *services.AuthService
    userService  *services.UserService
    tokenService *services.TokenService
    logger       *zap.SugaredLogger
}

func NewAuthHandler(authService *services.AuthService, userService *services.UserService, tokenService *services.TokenService, logger *zap.SugaredLogger) *AuthHandler {
    return &AuthHandler{
        authService:  authService,
        userService:  userService,
        tokenService: tokenService,
        logger:       logger,
    }
}

func (h *AuthHandler) Register(c *gin.Context) {
    var req models.RegisterRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.authService.Register(c.Request.Context(), &req)
    if err != nil {
        switch err {
        case services.ErrEmailAlreadyExists:
            c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
        case services.ErrUsernameAlreadyExists:
            c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
        default:
            h.logger.Errorf("Failed to register user: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req models.LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    userAgent := c.GetHeader("User-Agent")
    ip := c.ClientIP()

    user, session, err := h.authService.Login(c.Request.Context(), &req, userAgent, ip)
    if err != nil {
        if err == services.ErrInvalidCredentials {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
        } else {
            h.logger.Errorf("Failed to login: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    // Generate access token
    accessToken, expiresAt, err := h.tokenService.GenerateToken(user.ID, user.Email, user.Username)
    if err != nil {
        h.logger.Errorf("Failed to generate token: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    c.JSON(http.StatusOK, models.TokenResponse{
        AccessToken:  accessToken,
        RefreshToken: session.RefreshToken,
        ExpiresAt:    expiresAt,
    })
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
    var req models.RefreshRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get session
    session, err := h.authService.GetSessionByRefreshToken(c.Request.Context(), req.RefreshToken)
    if err != nil {
        if err == services.ErrInvalidToken {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
        } else {
            h.logger.Errorf("Failed to get session: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    // Get user
    user, err := h.userService.GetUserByID(c.Request.Context(), session.UserID)
    if err != nil {
        h.logger.Errorf("Failed to get user: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    // Generate new access token
    accessToken, expiresAt, err := h.tokenService.GenerateToken(user.ID, user.Email, user.Username)
    if err != nil {
        h.logger.Errorf("Failed to generate token: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    c.JSON(http.StatusOK, models.TokenResponse{
        AccessToken:  accessToken,
        RefreshToken: session.RefreshToken,
        ExpiresAt:    expiresAt,
    })
}

func (h *AuthHandler) Logout(c *gin.Context) {
    // Get token from context (set by auth middleware)
    claims, _ := c.Get("claims")
    tokenClaims := claims.(*services.TokenClaims)

    // Blacklist the token
    if err := h.tokenService.BlacklistToken(c.Request.Context(), tokenClaims.ID, tokenClaims.ExpiresAt.Time); err != nil {
        h.logger.Errorf("Failed to blacklist token: %v", err)
    }

    // Delete all user sessions if requested
    if c.Query("all") == "true" {
        if err := h.authService.DeleteAllUserSessions(c.Request.Context(), tokenClaims.UserID); err != nil {
            h.logger.Errorf("Failed to delete sessions: %v", err)
        }
    }

    c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
    token := c.Query("token")
    if token == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
        return
    }

    if err := h.authService.VerifyEmail(c.Request.Context(), token); err != nil {
        if err == services.ErrInvalidToken {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
        } else {
            h.logger.Errorf("Failed to verify email: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
    var req struct {
        Email string `json:"email" binding:"required,email"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.authService.ForgotPassword(c.Request.Context(), req.Email); err != nil {
        h.logger.Errorf("Failed to process forgot password: %v", err)
    }

    // Always return success to prevent email enumeration
    c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
    var req struct {
        Token    string `json:"token" binding:"required"`
        Password string `json:"password" binding:"required,min=8"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.authService.ResetPassword(c.Request.Context(), req.Token, req.Password); err != nil {
        if err == services.ErrInvalidToken {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
        } else {
            h.logger.Errorf("Failed to reset password: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}