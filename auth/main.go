package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "auth-service/internal/config"
    "auth-service/internal/database"
    "auth-service/internal/handlers"
    "auth-service/internal/middleware"
    "auth-service/internal/redis"
    "auth-service/internal/services"

    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
)

func main() {
    // Initialize logger
    logger, _ := zap.NewProduction()
    defer logger.Sync()
    sugar := logger.Sugar()

    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        sugar.Fatalf("Failed to load config: %v", err)
    }

    // Initialize database
    db, err := database.New(cfg.DatabaseURL)
    if err != nil {
        sugar.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()

    // Run migrations
    if err := db.Migrate(); err != nil {
        sugar.Fatalf("Failed to run migrations: %v", err)
    }

    // Initialize Redis
    redisClient := redis.New(cfg.RedisURL)
    defer redisClient.Close()

    // Initialize services
    authService := services.NewAuthService(db, redisClient, cfg, sugar)
    userService := services.NewUserService(db, sugar)
    tokenService := services.NewTokenService(cfg.JWTSecret, cfg.JWTExpiry, redisClient, sugar)

    // Initialize handlers
    authHandler := handlers.NewAuthHandler(authService, userService, tokenService, sugar)
    userHandler := handlers.NewUserHandler(userService, sugar)

    // Setup router
    router := setupRouter(cfg, authHandler, userHandler, tokenService, sugar)

    // Start server
    srv := &http.Server{
        Addr:    fmt.Sprintf(":%d", cfg.Port),
        Handler: router,
    }

    // Graceful shutdown
    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            sugar.Fatalf("Failed to start server: %v", err)
        }
    }()

    sugar.Infof("Auth service started on port %d", cfg.Port)

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    sugar.Info("Shutting down server...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        sugar.Fatalf("Server forced to shutdown: %v", err)
    }

    sugar.Info("Server exited")
}

func setupRouter(
    cfg *config.Config,
    authHandler *handlers.AuthHandler,
    userHandler *handlers.UserHandler,
    tokenService *services.TokenService,
    logger *zap.SugaredLogger,
) *gin.Engine {
    if cfg.Environment == "production" {
        gin.SetMode(gin.ReleaseMode)
    }

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