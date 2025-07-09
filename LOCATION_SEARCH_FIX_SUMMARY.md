# Location Search Logout Fix Summary

## Problem
When logged-in users searched for locations, they were being automatically logged out.

## Root Causes
1. **Frontend Issue**: The location search was using GET instead of POST method
2. **Backend Issue**: The address service was missing the JWT SECRET_KEY environment variable
3. **Frontend Interceptor**: The API interceptor was logging out users on ANY 401 response

## Fixes Applied

### 1. Frontend - Changed Location Search to POST
**File**: `frontend/src/services/location.service.ts`
```typescript
// Changed from:
const { data } = await api.get<Location[]>('/api/v1/addresses/search', {
  params: { query, limit }
});

// To:
const { data } = await api.post<Location[]>('/api/v1/addresses/search', {
  query,
  limit,
});
```

### 2. Backend - Added JWT Secret to Address Service
**File**: `docker-compose.yml`
```yaml
address:
  environment:
    DATABASE_URL: "postgresql+asyncpg://postgres:postgres@postgis:5432/address_db"
    REDIS_URL: "redis://redis:6379"
    SECRET_KEY: "your-super-secret-jwt-key"  # Added this line
    PORT: 8000
    DEBUG: "true"
    ALLOWED_ORIGINS: '["http://localhost", "http://frontend"]'
```

### 3. Frontend - Updated API Interceptor
**File**: `frontend/src/services/api.ts`
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't logout for address service errors
      const isAddressService = error.config?.url?.includes('/api/v1/addresses');
      
      if (!isAddressService) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        // For address service, just show an error message
        toast.error('Location service temporarily unavailable');
      }
    }
    return Promise.reject(error);
  }
);
```

### 4. Backend - Fixed JWT Claim Handling
**File**: `address/src/auth.py`
```python
# Changed to accept both 'user_id' and 'sub' claims
user_id = payload.get("user_id") or payload.get("sub")
```

## Verification
All fixes have been verified with automated tests:
- ✅ Location search now uses POST method
- ✅ Address service properly authenticates JWT tokens
- ✅ Frontend no longer logs out users on address service errors
- ✅ Users remain authenticated even if location search has issues

## Test Commands
```bash
# Test location search functionality
./test_location_search_final.sh

# Test comprehensive fixes
./test_all_fixes.sh
```