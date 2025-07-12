# Mobile Testing Guide for Tap In

## Prerequisites
1. Android Studio installed
2. Android device with Developer Mode and USB Debugging enabled
3. Phone and computer on the same network
4. Docker services running on your computer

## Quick Start

### 1. Start Backend Services
```bash
# From project root
docker-compose up -d
```

### 2. Build Mobile App
```bash
cd frontend
./build-mobile.sh
```

### 3. Open in Android Studio
```bash
npx cap open android
```

### 4. Run on Device
- In Android Studio, select your connected device
- Click the green "Run" button (or press Shift+F10)

## Testing Without Android Studio

### Generate APK
```bash
cd android
./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

### Install via ADB
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Network Configuration

The app is configured to connect to your local IP: `192.168.2.71`

If your IP changes:
1. Run `node get-local-ip.cjs` to find new IP
2. Update `.env.mobile` with new IP
3. Rebuild with `./build-mobile.sh`

## Troubleshooting

### Connection Issues
- Ensure phone and computer are on same WiFi network
- Check firewall settings allow connections on ports:
  - 3080 (Frontend/Nginx)
  - 8080 (Auth)
  - 3001 (Chat WebSocket)
  - 8000 (Address)

### Location Permission
The app will request location permission on first launch.
Make sure to allow it for the "Tap In" feature to work.

### WebSocket Issues
If chat doesn't connect, check:
- Redis is running: `docker ps | grep redis`
- Chat service logs: `docker-compose logs chat`

## Features to Test

1. **Registration/Login**: Create new account or login
2. **Tap In**: Click the big button to join your neighborhood
3. **Chat**: Send messages in the hex chat room
4. **Location**: Verify it detects your correct neighborhood
5. **Real-time**: Test with multiple devices in same hex

## Development Tips

### Live Reload (Optional)
For faster development, you can serve the app from your computer:
```bash
# In capacitor.config.ts, add:
server: {
  url: 'http://192.168.2.71:5173',
  cleartext: true
}

# Then run:
npm run dev
npx cap sync android
npx cap run android
```

### Debug Console
Use Chrome DevTools:
1. Open Chrome
2. Go to `chrome://inspect`
3. Find your app and click "inspect"