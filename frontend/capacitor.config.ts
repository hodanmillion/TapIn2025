import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tapin.app',
  appName: 'Tap In',
  webDir: 'dist',
  server: {
    // Allow connections to local network for development
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    // Allow HTTP connections for local testing
    allowMixedContent: true
  }
};

export default config;