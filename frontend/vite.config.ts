import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/v1/users': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/v1/profile': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/social': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/search': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/upload': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/settings': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/messages': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/rooms': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      '/api/v1/addresses': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/v1/spatial': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});