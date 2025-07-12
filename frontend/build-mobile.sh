#!/bin/bash

# Build with mobile environment
echo "Building for mobile with local network configuration..."
cp .env.mobile .env.production.local

# Build the React app
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio (optional)
echo ""
echo "Build complete!"
echo ""
echo "To test on your Android device:"
echo "1. Make sure your phone and computer are on the same network"
echo "2. Enable Developer Mode on your Android device"
echo "3. Enable USB Debugging"
echo "4. Connect your device via USB"
echo "5. Run: npx cap open android"
echo "6. In Android Studio, click the 'Run' button"
echo ""
echo "Your backend services should be accessible at:"
echo "  - Frontend: http://192.168.2.71:3080"
echo "  - Auth API: http://192.168.2.71:8080"
echo "  - Chat WebSocket: ws://192.168.2.71:3001"
echo ""
echo "Make sure Docker services are running!"