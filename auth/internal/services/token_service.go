package services

import (
    "context"
    "fmt"
    "time"

    "auth-service/internal/redis"
    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "go.uber.org/zap"
)

type TokenClaims struct {
    UserID   uuid.UUID `json:"user_id"`
    Email    string    `json:"email"`
    Username string    `json:"username"`
    jwt.RegisteredClaims
}

type TokenService struct {
    jwtSecret     []byte
    jwtExpiry     time.Duration
    redis         *redis.Client
    logger        *zap.SugaredLogger
}

func NewTokenService(jwtSecret string, jwtExpiry time.Duration, redis *redis.Client, logger *zap.SugaredLogger) *TokenService {
    return &TokenService{
        jwtSecret: []byte(jwtSecret),
        jwtExpiry: jwtExpiry,
        redis:     redis,
        logger:    logger,
    }
}

func (s *TokenService) GenerateToken(userID uuid.UUID, email, username string) (string, time.Time, error) {
    expiresAt := time.Now().Add(s.jwtExpiry)
    
    claims := TokenClaims{
        UserID:   userID,
        Email:    email,
        Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(expiresAt),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            ID:        uuid.New().String(),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    signedToken, err := token.SignedString(s.jwtSecret)
    if err != nil {
        return "", time.Time{}, fmt.Errorf("sign token: %w", err)
    }

    return signedToken, expiresAt, nil
}

func (s *TokenService) ValidateToken(tokenString string) (*TokenClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return s.jwtSecret, nil
    })

    if err != nil {
        return nil, fmt.Errorf("parse token: %w", err)
    }

    if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
        // Check if token is blacklisted
        blacklisted, err := s.redis.Exists(context.Background(), fmt.Sprintf("blacklist:%s", claims.ID))
        if err != nil {
            s.logger.Errorf("Failed to check blacklist: %v", err)
        }
        if blacklisted {
            return nil, fmt.Errorf("token is blacklisted")
        }

        return claims, nil
    }

    return nil, fmt.Errorf("invalid token")
}

func (s *TokenService) BlacklistToken(ctx context.Context, tokenID string, expiry time.Time) error {
    key := fmt.Sprintf("blacklist:%s", tokenID)
    ttl := time.Until(expiry)
    
    if ttl > 0 {
        return s.redis.Set(ctx, key, "1", ttl)
    }
    
    return nil
}