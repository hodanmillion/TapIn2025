# Frontend Service - React SPA

The frontend service provides the user interface for the Tap In location-based chat application. Built with React, TypeScript, and Vite for a fast, modern development experience.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │   Pages    │  │ Components │  │  Providers │  │  Services │ │
│  │            │  │            │  │            │  │           │ │
│  │ • Home     │  │ • Layout   │  │ • Auth     │  │ • API     │ │
│  │ • Chat     │  │ • Chat UI  │  │ • Socket   │  │ • Auth    │ │
│  │ • Login    │  │ • Maps     │  │ • Location │  │ • Chat    │ │
│  │ • Profile  │  │ • Forms    │  │ • Theme    │  │ • Address │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                         API Layer (Axios)                         │
├─────────────────────────────────────────────────────────────────┤
│                      WebSocket Connection                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        Backend Services
```

## 🚀 Features

- **Real-time Chat**: WebSocket-based real-time messaging
- **Location Services**: Browser geolocation API integration
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **JWT Authentication**: Secure token-based authentication
- **Type Safety**: Full TypeScript support
- **Fast Development**: Vite with HMR (Hot Module Replacement)
- **State Management**: React Context API and Zustand
- **Route Protection**: Protected routes for authenticated users

## 🛠️ Tech Stack

- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **React Router v6**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client
- **React Query**: Server state management
- **Zustand**: Client state management
- **Radix UI**: Accessible component primitives

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # App-level configuration
│   │   ├── providers/          # Context providers
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── SocketProvider.tsx
│   │   │   └── LocationProvider.tsx
│   │   ├── Router.tsx          # Route configuration
│   │   └── App.tsx            # Root component
│   │
│   ├── features/              # Feature modules
│   │   ├── auth/             # Authentication
│   │   ├── chat/             # Chat functionality
│   │   ├── home/             # Home page
│   │   ├── location/         # Location search
│   │   └── user/             # User profile
│   │
│   ├── shared/               # Shared resources
│   │   ├── components/       # Reusable components
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   │
│   ├── services/            # API services
│   │   ├── api.ts          # Axios instance
│   │   ├── auth.service.ts
│   │   ├── chat.service.ts
│   │   └── location.service.ts
│   │
│   └── main.tsx            # Entry point
│
├── public/                 # Static assets
├── index.html             # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🚦 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Update `.env` with your configuration:

```env
# API URLs
VITE_API_URL=http://localhost:80
VITE_AUTH_SERVICE_URL=http://localhost:8080
VITE_CHAT_SERVICE_URL=http://localhost:3001
VITE_ADDRESS_SERVICE_URL=http://localhost:8000

# WebSocket URL
VITE_WS_URL=ws://localhost:3001

# Google Maps API Key (optional)
VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

## 🔌 Backend Services Integration

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

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage

## 🔐 Authentication Flow

1. User enters credentials on login/register page
2. Frontend sends request to Auth Service
3. Auth Service returns JWT token
4. Frontend stores token in localStorage
5. Token included in Authorization header for API requests
6. Token validated by backend services

## 💬 WebSocket Connection

```typescript
// WebSocket connection flow
1. User navigates to chat room
2. Frontend establishes WebSocket connection to Chat Service
3. Send "Join" message with user info and JWT
4. Receive "MessageHistory" with previous messages
5. Send/receive "Message" events in real-time
6. Handle "UserJoined" and "UserLeft" events
```

## 🗺️ Location Features

- **Find Nearby Chats**: Uses browser geolocation API
- **Search by Address**: Geocoding through Address Service
- **Location Format**: `latitude_longitude` (e.g., `40.7128_-74.0060`)
- **Mock Location**: Available in development with `?mockLocation=true`

## 🚀 Production Build

```bash
# Build for production
npm run build

# Build output will be in the dist/ directory
```

### Docker Deployment

```dockerfile
# Multi-stage build
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## 🐛 Troubleshooting

### CORS Errors
- Ensure backend services have proper CORS configuration
- Check proxy settings in `vite.config.ts`

### WebSocket Connection Failed
- Verify Chat Service is running
- Check WebSocket URL in environment variables
- Ensure JWT token is valid

### Geolocation Not Working
- Check browser permissions
- Use HTTPS in production
- Try mock location in development

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for all new code
3. Write tests for new features
4. Follow the ESLint configuration
5. Use conventional commits

## 📄 License

Part of the Tap In project - see root LICENSE file.