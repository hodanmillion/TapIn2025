package handlers

import (
    "net/http"

    "auth-service/internal/services"

    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
)

type UserHandler struct {
    userService *services.UserService
    logger      *zap.SugaredLogger
}

func NewUserHandler(userService *services.UserService, logger *zap.SugaredLogger) *UserHandler {
    return &UserHandler{
        userService: userService,
        logger:      logger,
    }
}

func (h *UserHandler) GetCurrentUser(c *gin.Context) {
    claims, _ := c.Get("claims")
    tokenClaims := claims.(*services.TokenClaims)

    user, err := h.userService.GetUserByID(c.Request.Context(), tokenClaims.UserID)
    if err != nil {
        h.logger.Errorf("Failed to get user: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    c.JSON(http.StatusOK, user)
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
    claims, _ := c.Get("claims")
    tokenClaims := claims.(*services.TokenClaims)

    var req struct {
        Username string `json:"username" binding:"required,min=3,max=50"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.userService.UpdateProfile(c.Request.Context(), tokenClaims.UserID, req.Username); err != nil {
        h.logger.Errorf("Failed to update profile: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
    claims, _ := c.Get("claims")
    tokenClaims := claims.(*services.TokenClaims)

    var req struct {
        OldPassword string `json:"old_password" binding:"required"`
        NewPassword string `json:"new_password" binding:"required,min=8"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.userService.ChangePassword(c.Request.Context(), tokenClaims.UserID, req.OldPassword, req.NewPassword); err != nil {
        if err == services.ErrInvalidCredentials {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid old password"})
        } else {
            h.logger.Errorf("Failed to change password: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        }
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func (h *UserHandler) DeleteAccount(c *gin.Context) {
    claims, _ := c.Get("claims")
    tokenClaims := claims.(*services.TokenClaims)

    if err := h.userService.DeleteUser(c.Request.Context(), tokenClaims.UserID); err != nil {
        h.logger.Errorf("Failed to delete user: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}