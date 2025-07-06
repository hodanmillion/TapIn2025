package test

import (
	"context"
	"log"
	"testing"
	"time"

	"auth-service/internal/config"
	"auth-service/internal/database"
	"auth-service/internal/models"
	"auth-service/internal/redis"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	redisContainer "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// TestDB wraps the database for testing
type TestDB struct {
	*database.DB
	Container *postgres.PostgresContainer
}

// TestRedis wraps Redis client for testing
type TestRedis struct {
	*redis.Client
	Container *redisContainer.RedisContainer
}

// TestSuite provides common test infrastructure
type TestSuite struct {
	DB     *TestDB
	Redis  *TestRedis
	Config *config.Config
	Logger *zap.SugaredLogger
	ctx    context.Context
}

// NewTestSuite creates a new test suite with containers
func NewTestSuite(t *testing.T) *TestSuite {
	ctx := context.Background()

	// Create logger
	logger, _ := zap.NewDevelopment()
	sugar := logger.Sugar()

	// Setup PostgreSQL container
	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:16-alpine"),
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("testuser"),
		postgres.WithPassword("testpass"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second),
		),
	)
	require.NoError(t, err)

	// Get database connection string
	dbURL, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)

	// Setup database
	db, err := database.New(dbURL)
	require.NoError(t, err)

	// Run migrations
	err = db.Migrate()
	require.NoError(t, err)

	testDB := &TestDB{
		DB:        db,
		Container: pgContainer,
	}

	// Setup Redis container
	redisContainer, err := redisContainer.RunContainer(ctx,
		testcontainers.WithImage("redis:7-alpine"),
		testcontainers.WithWaitStrategy(wait.ForLog("Ready to accept connections")),
	)
	require.NoError(t, err)

	// Get Redis connection string
	redisURL, err := redisContainer.ConnectionString(ctx)
	require.NoError(t, err)

	// Setup Redis client
	redisClient := redis.New(redisURL)

	testRedis := &TestRedis{
		Client:    redisClient,
		Container: redisContainer,
	}

	// Create test config
	cfg := &config.Config{
		Port:           8080,
		Environment:    "test",
		DatabaseURL:    dbURL,
		RedisURL:       redisURL,
		JWTSecret:      "test-secret-key",
		JWTExpiry:      15 * time.Minute,
		RefreshExpiry:  24 * time.Hour,
		AllowedOrigins: []string{"*"},
		RateLimit:      100,
	}

	return &TestSuite{
		DB:     testDB,
		Redis:  testRedis,
		Config: cfg,
		Logger: sugar,
		ctx:    ctx,
	}
}

// Cleanup closes all resources
func (ts *TestSuite) Cleanup(t *testing.T) {
	if ts.DB != nil {
		ts.DB.Close()
		if err := ts.DB.Container.Terminate(ts.ctx); err != nil {
			log.Printf("Failed to terminate postgres container: %v", err)
		}
	}

	if ts.Redis != nil {
		ts.Redis.Close()
		if err := ts.Redis.Container.Terminate(ts.ctx); err != nil {
			log.Printf("Failed to terminate redis container: %v", err)
		}
	}
}

// CleanDatabase truncates all tables
func (ts *TestSuite) CleanDatabase(t *testing.T) {
	_, err := ts.DB.Pool().Exec(ts.ctx, "TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE")
	require.NoError(t, err)
}

// CreateTestUser creates a test user in the database
func (ts *TestSuite) CreateTestUser(t *testing.T, email, username, password string) *models.User {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)

	user := &models.User{}
	err = ts.DB.Pool().QueryRow(ts.ctx,
		`INSERT INTO users (email, username, password_hash, email_verified)
		 VALUES ($1, $2, $3, true)
		 RETURNING id, email, username, email_verified, created_at, updated_at`,
		email, username, string(hashedPassword),
	).Scan(&user.ID, &user.Email, &user.Username, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt)
	require.NoError(t, err)

	return user
}

// CreateTestSession creates a test session in the database
func (ts *TestSuite) CreateTestSession(t *testing.T, userID uuid.UUID) *models.Session {
	session := &models.Session{
		ID:           uuid.New(),
		UserID:       userID,
		RefreshToken: "test-refresh-token-" + uuid.New().String(),
		UserAgent:    "test-agent",
		IP:           "127.0.0.1",
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}

	_, err := ts.DB.Pool().Exec(ts.ctx,
		`INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		session.ID, session.UserID, session.RefreshToken,
		session.UserAgent, session.IP, session.ExpiresAt,
	)
	require.NoError(t, err)

	return session
}

// MockTestSuite provides mocked dependencies for unit tests
type MockTestSuite struct {
	Config *config.Config
	Logger *zap.SugaredLogger
}

// NewMockTestSuite creates a test suite with mocked dependencies
func NewMockTestSuite() *MockTestSuite {
	logger, _ := zap.NewDevelopment()
	sugar := logger.Sugar()

	cfg := &config.Config{
		Port:           8080,
		Environment:    "test",
		DatabaseURL:    "mock-db-url",
		RedisURL:       "mock-redis-url",
		JWTSecret:      "test-secret-key",
		JWTExpiry:      15 * time.Minute,
		RefreshExpiry:  24 * time.Hour,
		AllowedOrigins: []string{"*"},
		RateLimit:      100,
	}

	return &MockTestSuite{
		Config: cfg,
		Logger: sugar,
	}
}

// AssertErrorContains checks if error contains expected message
func AssertErrorContains(t *testing.T, err error, expected string) {
	require.Error(t, err)
	require.Contains(t, err.Error(), expected)
}

// AssertNoError is a helper for require.NoError with better error messages
func AssertNoError(t *testing.T, err error, msgAndArgs ...interface{}) {
	if err != nil {
		if len(msgAndArgs) > 0 {
			require.NoError(t, err, msgAndArgs...)
		} else {
			require.NoError(t, err, "Unexpected error occurred")
		}
	}
}

// TestData provides common test data
var TestData = struct {
	ValidEmail    string
	ValidUsername string
	ValidPassword string
	InvalidEmail  string
	ShortPassword string
}{
	ValidEmail:    "test@example.com",
	ValidUsername: "testuser",
	ValidPassword: "password123",
	InvalidEmail:  "invalid-email",
	ShortPassword: "123",
}