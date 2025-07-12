package services

import (
    "context"
    "crypto/rand"
    "encoding/hex"
    "errors"
    "fmt"
    "time"

    "auth-service/internal/config"
    "auth-service/internal/database"
    "auth-service/internal/events"
    "auth-service/internal/models"
    "auth-service/internal/redis"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5"
    "go.uber.org/zap"
    "golang.org/x/crypto/bcrypt"
)

var (
    ErrInvalidCredentials = errors.New("invalid credentials")
    ErrEmailAlreadyExists = errors.New("email already exists")
    ErrUsernameAlreadyExists = errors.New("username already exists")
    ErrInvalidToken = errors.New("invalid token")
    ErrTokenExpired = errors.New("token expired")
)

type AuthService struct {
    db       *database.DB
    redis    *redis.Client
    config   *config.Config
    logger   *zap.SugaredLogger
    rabbitMQ EventPublisher
}

type EventPublisher interface {
    PublishUserEvent(event *events.UserEvent) error
}

func NewAuthService(db *database.DB, redis *redis.Client, config *config.Config, logger *zap.SugaredLogger, rabbitMQ EventPublisher) *AuthService {
    return &AuthService{
        db:       db,
        redis:    redis,
        config:   config,
        logger:   logger,
        rabbitMQ: rabbitMQ,
    }
}

func (s *AuthService) Register(ctx context.Context, req *models.RegisterRequest) (*models.User, error) {
    // Check if email exists
    var exists bool
    err := s.db.Pool().QueryRow(ctx, 
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", 
        req.Email,
    ).Scan(&exists)
    if err != nil {
        return nil, fmt.Errorf("check email: %w", err)
    }
    if exists {
        return nil, ErrEmailAlreadyExists
    }

    // Check if username exists
    err = s.db.Pool().QueryRow(ctx,
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
        req.Username,
    ).Scan(&exists)
    if err != nil {
        return nil, fmt.Errorf("check username: %w", err)
    }
    if exists {
        return nil, ErrUsernameAlreadyExists
    }

    // Hash password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, fmt.Errorf("hash password: %w", err)
    }

    // Generate email verification token
    emailToken := generateToken()

    // Create user
    user := &models.User{}
    err = s.db.Pool().QueryRow(ctx,
        `INSERT INTO users (email, username, password_hash, email_token)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, username, email_verified, created_at, updated_at`,
        req.Email, req.Username, string(hashedPassword), emailToken,
    ).Scan(&user.ID, &user.Email, &user.Username, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt)
    
    if err != nil {
        return nil, fmt.Errorf("create user: %w", err)
    }

    // Send verification email (implement email service)
    // s.emailService.SendVerificationEmail(user.Email, emailToken)

    // Publish user registration event
    event := events.NewUserEvent(events.UserRegister, user.ID.String(), user.Username)
    event.Data["email"] = user.Email
    if err := s.rabbitMQ.PublishUserEvent(event); err != nil {
        s.logger.Errorf("Failed to publish user registration event: %v", err)
        // Don't fail the registration if event publishing fails
    }

    return user, nil
}

func (s *AuthService) Login(ctx context.Context, req *models.LoginRequest, userAgent, ip string) (*models.User, *models.Session, error) {
    // Get user by email
    user := &models.User{}
    err := s.db.Pool().QueryRow(ctx,
        `SELECT id, email, username, password_hash, email_verified, created_at, updated_at, last_login
         FROM users WHERE email = $1`,
        req.Email,
    ).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash, 
           &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt, &user.LastLogin)
    
    if err != nil {
        if err == pgx.ErrNoRows {
            return nil, nil, ErrInvalidCredentials
        }
        return nil, nil, fmt.Errorf("get user: %w", err)
    }

    // Verify password
    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
        return nil, nil, ErrInvalidCredentials
    }

    // Update last login
    _, err = s.db.Pool().Exec(ctx,
        "UPDATE users SET last_login = NOW() WHERE id = $1",
        user.ID,
    )
    if err != nil {
        s.logger.Errorf("Failed to update last login: %v", err)
    }

    // Create session
    session := &models.Session{
        ID:           uuid.New(),
        UserID:       user.ID,
        RefreshToken: generateToken(),
        UserAgent:    userAgent,
        IP:           ip,
        ExpiresAt:    time.Now().Add(s.config.RefreshExpiry),
    }

    _, err = s.db.Pool().Exec(ctx,
        `INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        session.ID, session.UserID, session.RefreshToken, 
        session.UserAgent, session.IP, session.ExpiresAt,
    )
    if err != nil {
        return nil, nil, fmt.Errorf("create session: %w", err)
    }

    return user, session, nil
}

func (s *AuthService) VerifyEmail(ctx context.Context, token string) error {
    // Update user
    result, err := s.db.Pool().Exec(ctx,
        `UPDATE users SET email_verified = true, email_token = NULL
         WHERE email_token = $1 AND email_verified = false`,
        token,
    )
    if err != nil {
        return fmt.Errorf("verify email: %w", err)
    }

    if result.RowsAffected() == 0 {
        return ErrInvalidToken
    }

    return nil
}

func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
    // Generate reset token
    resetToken := generateToken()
    resetExpiry := time.Now().Add(1 * time.Hour)

    // Update user
    result, err := s.db.Pool().Exec(ctx,
        `UPDATE users SET reset_token = $1, reset_expiry = $2
         WHERE email = $3`,
        resetToken, resetExpiry, email,
    )
    if err != nil {
        return fmt.Errorf("set reset token: %w", err)
    }

    if result.RowsAffected() == 0 {
        // Don't reveal if email exists
        return nil
    }

    // Send reset email (implement email service)
    // s.emailService.SendResetEmail(email, resetToken)

    return nil
}

func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
    // Hash new password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
    if err != nil {
        return fmt.Errorf("hash password: %w", err)
    }

    // Update password
    result, err := s.db.Pool().Exec(ctx,
        `UPDATE users SET password_hash = $1, reset_token = NULL, reset_expiry = NULL
         WHERE reset_token = $2 AND reset_expiry > NOW()`,
        string(hashedPassword), token,
    )
    if err != nil {
        return fmt.Errorf("reset password: %w", err)
    }

    if result.RowsAffected() == 0 {
        return ErrInvalidToken
    }

    return nil
}

func (s *AuthService) GetSessionByRefreshToken(ctx context.Context, token string) (*models.Session, error) {
    session := &models.Session{}
    err := s.db.Pool().QueryRow(ctx,
        `SELECT id, user_id, refresh_token, user_agent, ip, expires_at, created_at
         FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()`,
        token,
    ).Scan(&session.ID, &session.UserID, &session.RefreshToken, 
           &session.UserAgent, &session.IP, &session.ExpiresAt, &session.CreatedAt)
    
    if err != nil {
        if err == pgx.ErrNoRows {
            return nil, ErrInvalidToken
        }
        return nil, fmt.Errorf("get session: %w", err)
    }

    return session, nil
}

func (s *AuthService) DeleteSession(ctx context.Context, sessionID uuid.UUID) error {
    _, err := s.db.Pool().Exec(ctx,
        "DELETE FROM sessions WHERE id = $1",
        sessionID,
    )
    return err
}

func (s *AuthService) DeleteAllUserSessions(ctx context.Context, userID uuid.UUID) error {
    _, err := s.db.Pool().Exec(ctx,
        "DELETE FROM sessions WHERE user_id = $1",
        userID,
    )
    return err
}

func generateToken() string {
    b := make([]byte, 32)
    rand.Read(b)
    return hex.EncodeToString(b)
}