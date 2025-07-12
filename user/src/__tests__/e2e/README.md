# User Service E2E Tests

This directory contains end-to-end integration tests for the user service functionality.

## Test Categories

### Block System Tests
- `test_block_api.js` - Core blocking API functionality
- `test_block_simple.js` - Basic block/unblock operations
- `test_block_existing_users.js` - Blocking with pre-existing users
- `test_block_create_users.js` - User creation for blocking tests
- `test_block_with_profile_creation.js` - Blocking with automatic profile creation
- `test_block_comprehensive.js` - Complete blocking system test

### Profile Management Tests
- `test_auto_profile_creation.js` - Automatic profile creation on registration
- `test_profile_creation_verbose.js` - Detailed profile creation testing

### Conversation & DM Tests
- `test_conversations.js` - Conversation management endpoints
- `test_dm_chat.js` - Direct message chat functionality
- `test_dm_chat_fixed.js` - Fixed DM chat implementation
- `test_dm_chat_working.js` - Working DM chat verification

## Running Tests

To run these tests, ensure all services are running:

```bash
cd /path/to/tap_in
docker-compose up -d

# Run individual test
node user/src/__tests__/e2e/test_conversations.js

# Or run from user service directory
cd user
node src/__tests__/e2e/test_conversations.js
```

## Test Requirements

These tests require:
- User service running on port 3002
- Auth service running on port 3000
- Chat service running on port 3001 (for DM tests)
- PostgreSQL database
- Redis (for some tests)

All tests create their own test users and clean up after themselves.