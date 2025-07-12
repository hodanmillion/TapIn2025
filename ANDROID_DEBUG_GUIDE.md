# Android Registration Debug Guide

## 1. Access the Debug Page

After installing the APK on your Android device:
1. Open the app
2. Navigate to `/debug` in your browser's address bar (e.g., `http://192.168.1.10:3080/debug`)
3. Click "Run Connectivity Test"

## 2. Expected Results

The debug page will test:
- Frontend health endpoint
- Auth service connectivity 
- Registration endpoint availability
- Network information

## 3. Common Issues and Solutions

### Issue: "Network Error" on all endpoints
**Solution**: 
- Ensure phone and computer are on same WiFi network
- Check `.env.mobile` has correct computer IP:
  ```bash
  VITE_API_BASE_URL=http://YOUR_COMPUTER_IP:3080
  ```
- Rebuild the app after changing `.env.mobile`

### Issue: Auth service returns 404
**Solution**:
- The auth service needs to be rebuilt with the health endpoint
- Run: `docker-compose up -d --build auth`

### Issue: CORS errors
**Solution**:
- Already configured `ALLOWED_ORIGINS: "*"` in docker-compose.yml
- Restart services: `docker-compose restart auth address`

## 4. Testing Registration

1. First run the debug page to ensure connectivity
2. If all tests pass, try registration with:
   - Valid email format
   - Username (alphanumeric)
   - Password (8+ characters)

## 5. Check Logs

Monitor backend logs while testing:
```bash
# Auth service logs
docker-compose logs -f auth

# All services
docker-compose logs -f
```

## 6. Enhanced Error Information

The app now logs detailed error information to the console:
- URL being called
- HTTP method
- Response status
- Error data
- Network errors

Use Chrome DevTools with the Android device:
1. Enable USB debugging on Android
2. Connect via USB
3. Open chrome://inspect on desktop Chrome
4. Click "inspect" under your app

## 7. Manual API Test

Test registration directly from your phone's browser:
```javascript
// Paste this in the browser console
fetch('http://YOUR_COMPUTER_IP:3080/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    username: 'testuser',
    password: 'testpass123'
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
```

## 8. Network Configuration Check

Ensure Docker services are accessible:
```bash
# On your computer
netstat -an | grep -E "3080|8080|8000"
```

Should show:
- 0.0.0.0:3080 (frontend)
- 0.0.0.0:8080 (auth)
- 0.0.0.0:8000 (address)