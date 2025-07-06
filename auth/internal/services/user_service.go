package services

import (
    "context"
    "fmt"

    "auth-service/internal/database"
    "auth-service/internal/models"

    "github.com/google/uuid"
    "go.uber.org/zap"
    "golang.org/x/crypto/bcrypt"
)

type UserService struct {
    db     *database.DB
    logger *zap.SugaredLogger
}

func NewUserService(db *database.DB, logger *zap.SugaredLogger) *UserService {
    return &UserService{
        db:     db,
        logger: logger,
    }
}

func (s *UserService) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
    user := &models.User{}
    err := s.db.Pool().QueryRow(ctx,
        `SELECT id, email, username, email_verified, created_at, updated_at, last_login
         FROM users WHERE id = $1`,
        userID,
    ).Scan(&user.ID, &user.Email, &user.Username, &user.EmailVerified, 
           &user.CreatedAt, &user.UpdatedAt, &user.LastLogin)
    
    if err != nil {
        return nil, fmt.Errorf("get user: %w", err)
    }

    return user, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, username string) error {
    _, err := s.db.Pool().Exec(ctx,
        "UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2",
        username, userID,
    )
    return err
}

func (s *UserService) ChangePassword(ctx context.Context, userID uuid.UUID, oldPassword, newPassword string) error {
    // Get current password hash
    var currentHash string
    err := s.db.Pool().QueryRow(ctx,
        "SELECT password_hash FROM users WHERE id = $1",
        userID,
    ).Scan(&currentHash)
    if err != nil {
        return fmt.Errorf("get password: %w", err)
    }

    // Verify old password
    if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(oldPassword)); err != nil {
        return ErrInvalidCredentials
    }

    // Hash new password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
    if err != nil {
        return fmt.Errorf("hash password: %w", err)
    }

    // Update password
    _, err = s.db.Pool().Exec(ctx,
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        string(hashedPassword), userID,
    )
    
    return err
}

func (s *UserService) DeleteUser(ctx context.Context, userID uuid.UUID) error {
    _, err := s.db.Pool().Exec(ctx,
        "DELETE FROM users WHERE id = $1",
        userID,
    )
    return err
}