package services

import (
	"context"
	"testing"

	"auth-service/test"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestUserService_GetUserByID(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	userService := NewUserService(suite.DB.DB, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name    string
		userID  uuid.UUID
		wantErr bool
	}{
		{
			name:    "existing user",
			userID:  testUser.ID,
			wantErr: false,
		},
		{
			name:    "non-existing user",
			userID:  uuid.New(),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := userService.GetUserByID(context.Background(), tt.userID)

			if tt.wantErr {
				require.Error(t, err)
				assert.Nil(t, user)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, testUser.ID, user.ID)
				assert.Equal(t, testUser.Email, user.Email)
				assert.Equal(t, testUser.Username, user.Username)
				assert.Equal(t, testUser.EmailVerified, user.EmailVerified)
				// Password hash should not be included
				assert.Empty(t, user.PasswordHash)
			}
		})
	}
}

func TestUserService_UpdateProfile(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	userService := NewUserService(suite.DB.DB, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name        string
		userID      uuid.UUID
		newUsername string
		wantErr     bool
	}{
		{
			name:        "successful update",
			userID:      testUser.ID,
			newUsername: "newusername",
			wantErr:     false,
		},
		{
			name:        "non-existing user",
			userID:      uuid.New(),
			newUsername: "newusername",
			wantErr:     false, // UPDATE with no rows affected doesn't error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userService.UpdateProfile(context.Background(), tt.userID, tt.newUsername)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)

				if tt.userID == testUser.ID {
					// Verify username was updated
					user, err := userService.GetUserByID(context.Background(), tt.userID)
					require.NoError(t, err)
					assert.Equal(t, tt.newUsername, user.Username)
				}
			}
		})
	}
}

func TestUserService_ChangePassword(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	userService := NewUserService(suite.DB.DB, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	tests := []struct {
		name        string
		userID      uuid.UUID
		oldPassword string
		newPassword string
		wantErr     bool
		errType     error
	}{
		{
			name:        "successful password change",
			userID:      testUser.ID,
			oldPassword: test.TestData.ValidPassword,
			newPassword: "newpassword123",
			wantErr:     false,
		},
		{
			name:        "wrong old password",
			userID:      testUser.ID,
			oldPassword: "wrongpassword",
			newPassword: "newpassword123",
			wantErr:     true,
			errType:     ErrInvalidCredentials,
		},
		{
			name:        "non-existing user",
			userID:      uuid.New(),
			oldPassword: "anypassword",
			newPassword: "newpassword123",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := userService.ChangePassword(context.Background(), tt.userID, tt.oldPassword, tt.newPassword)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errType != nil {
					assert.Equal(t, tt.errType, err)
				}
			} else {
				require.NoError(t, err)

				// Verify password was changed by getting the hash directly
				var passwordHash string
				err = suite.DB.Pool().QueryRow(context.Background(),
					"SELECT password_hash FROM users WHERE id = $1",
					tt.userID,
				).Scan(&passwordHash)
				require.NoError(t, err)

				// Verify new password works
				err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(tt.newPassword))
				assert.NoError(t, err)

				// Verify old password no longer works
				err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(tt.oldPassword))
				assert.Error(t, err)
			}
		})
	}
}

func TestUserService_DeleteUser(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	userService := NewUserService(suite.DB.DB, suite.Logger)

	// Create test user
	testUser := suite.CreateTestUser(t, test.TestData.ValidEmail, test.TestData.ValidUsername, test.TestData.ValidPassword)

	// Create session for the user (should be deleted due to CASCADE)
	suite.CreateTestSession(t, testUser.ID)

	// Delete user
	err := userService.DeleteUser(context.Background(), testUser.ID)
	require.NoError(t, err)

	// Verify user was deleted
	_, err = userService.GetUserByID(context.Background(), testUser.ID)
	assert.Error(t, err)

	// Verify sessions were also deleted (CASCADE)
	var count int
	err = suite.DB.Pool().QueryRow(context.Background(),
		"SELECT COUNT(*) FROM sessions WHERE user_id = $1",
		testUser.ID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count)
}

func TestUserService_DeleteNonExistingUser(t *testing.T) {
	suite := test.NewTestSuite(t)
	defer suite.Cleanup(t)

	userService := NewUserService(suite.DB.DB, suite.Logger)

	// Try to delete non-existing user
	err := userService.DeleteUser(context.Background(), uuid.New())
	require.NoError(t, err) // DELETE with no rows affected doesn't error
}