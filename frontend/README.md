# Location Chat Frontend

React TypeScript frontend for the location-based chat application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your Google Maps API key and backend service URLs.

## Development

Start the development server:
```bash
npm run dev
```

The app will run on http://localhost:5173

## Backend Services Integration

The frontend integrates with the following backend services:

### Auth Service (Go) - Port 8080
- Authentication endpoints: `/api/v1/auth/*`
- User management: `/api/v1/users/*`

### User Service (Node.js) - Port 3002  
- Profile management: `/api/v1/profile/*`
- Social features: `/api/v1/social/*`
- Search: `/api/v1/search/*`
- File uploads: `/api/v1/upload/*`
- Settings: `/api/v1/settings/*`

### Chat Service (Rust) - Port 3001
- REST API: `/api/messages/*`, `/api/rooms/*`
- WebSocket: `/ws/:location_id`

### Address Service (Python) - Port 8000
- Address management: `/api/v1/addresses/*`
- Spatial queries: `/api/v1/spatial/*`

## Build

Build for production:
```bash
npm run build
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Features

- Location-based chat rooms
- Real-time messaging via WebSocket
- User authentication and profiles
- Google Maps integration
- Social features (follow/unfollow)
- File uploads for avatars
- Responsive design with Tailwind CSS

## Architecture

- React 18 with TypeScript
- Vite for fast builds
- React Query for data fetching
- Socket.io for WebSocket communication
- Zustand for state management
- React Router for navigation
- Tailwind CSS for styling
- Radix UI for accessible components