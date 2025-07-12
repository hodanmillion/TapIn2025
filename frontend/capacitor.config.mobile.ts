import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tapin.app',
  appName: 'Tap In',
  webDir: 'dist',
  server: {
    // Load from the local network server instead of https://localhost
    url: 'http://192.168.2.71:3080',
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    // Allow HTTP connections for local testing
    allowMixedContent: true
  }
};

export default config;