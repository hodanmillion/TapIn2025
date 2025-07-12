# Test Organization Summary

This document outlines how tests have been organized across the tap_in project.

## Overview

Tests have been moved from the root directory into appropriate service folders and organized by type and scope.

## Organization Structure

### User Service Tests
**Location**: `user/src/__tests__/e2e/`

All user service related functionality tests including:
- Block system tests (`test_block_*.js`)
- Profile creation tests (`test_auto_profile_creation.js`, `test_profile_creation_verbose.js`)
- Conversation management tests (`test_conversations.js`)
- Direct message tests (`test_dm_chat*.js`)

**Documentation**: See `user/src/__tests__/e2e/README.md` for detailed descriptions.

### Debug Tests
**Location**: `debug-tests/`

Organized into subcategories:
- `auth/` - Authentication and JWT debugging tests
- `chat/` - Chat functionality debug tests
- `frontend/` - Frontend debugging and E2E tests
- `location/` - Location and geolocation debug tests
- `redis/` - Redis pubsub and broadcast debugging
- `websocket/` - WebSocket connection debugging
- `monitoring/` - General monitoring and analysis tools

### E2E Tests
**Location**: `e2e-tests/`

Formal end-to-end integration tests using Jest and Playwright:
- `basic-location-chat.test.js`
- `location-chat.test.js`
- `simple-connectivity.test.js`
- `run_hex_tests.sh` (moved from root)

### Service-Specific Unit Tests

#### Auth Service
**Location**: `auth/internal/*/`
- Handler tests in `handlers/*_test.go`
- Service tests in `services/*_test.go`
- Integration tests in `integration_test.go`

#### Chat Service 
**Location**: `chat/tests/`
- `location_chat_tests.rs`
- `simple_integration_tests.rs` 
- `test_hex_chat.rs`

#### User Service
**Location**: `user/src/__tests__/`
- Unit tests in `unit/`
- Integration tests in `integration/`
- E2E tests in `e2e/`

#### Address Service
**Location**: `address/tests/`
- `test_hex_api.py`
- `test_hex_service.py`

#### Frontend Service
**Location**: `frontend/src/`
- Component tests in feature folders (`__tests__/`)
- Service tests in `services/__tests__/`

## What Was Moved

### From Root to User Service E2E
- `test_block_*.js` → `user/src/__tests__/e2e/`
- `test_conversations.js` → `user/src/__tests__/e2e/`
- `test_dm_chat*.js` → `user/src/__tests__/e2e/`
- `test_auto_profile_creation.js` → `user/src/__tests__/e2e/`
- `test_profile_creation_verbose.js` → `user/src/__tests__/e2e/`

### From Root to E2E Tests
- `run_hex_tests.sh` → `e2e-tests/`

### Debug Tests Organized
- Auth-related files → `debug-tests/auth/`
- Frontend files → `debug-tests/frontend/`
- Redis files → `debug-tests/redis/`
- WebSocket files → `debug-tests/websocket/`
- Location files → `debug-tests/location/`

## Running Tests

### User Service Tests
```bash
cd user
# Run specific E2E test
node src/__tests__/e2e/test_conversations.js

# Run Jest tests
npm test
```

### Debug Tests
```bash
# Run specific debug test
node debug-tests/auth/test_simple_auth.sh
node debug-tests/chat/test_local_chat.js
```

### E2E Tests
```bash
cd e2e-tests
npm test

# Or run specific test
./run_hex_tests.sh
```

### Service Unit Tests
```bash
# Auth service (Go)
cd auth && go test ./...

# Chat service (Rust)  
cd chat && cargo test

# User service (Node.js)
cd user && npm test

# Address service (Python)
cd address && python -m pytest
```

## Benefits of This Organization

1. **Clear Separation**: Each service owns its tests
2. **Easier Maintenance**: Tests are co-located with the code they test
3. **Better CI/CD**: Can run service-specific tests independently
4. **Reduced Root Clutter**: Clean project root directory
5. **Organized Debug Tools**: Debug tests are categorized by functionality

## Notes

- All moved test files retain their original functionality
- No test logic was modified during the move
- README files added to document each test category
- Original file structure preserved where tests were already well-organized