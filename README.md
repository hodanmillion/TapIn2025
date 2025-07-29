# Tap In - Location-Based Chat Application

A real-time, location-based chat application that connects people in the same geographic area. Users can join chat rooms based on their current location or search for specific addresses to connect with local communities.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   Frontend                                    │
│                              React + TypeScript                               │
│                                 Port: 3080                                    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │   Nginx Proxy     │
                          │    Port: 80       │
                          └─────────┬─────────┘
                                    │
        ┌───────────────┬───────────┴───────────┬───────────────┐
        │               │                       │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────────────▼──────┐ ┌──────▼──────┐
│ Auth Service │ │User Service │ │   Chat Service     │ │Address Svc  │
│    (Go)      │ │  (Node.js)  │ │     (Rust)         │ │  (Python)   │
│  Port: 8080  │ │ Port: 3002  │ │   Port: 3001       │ │ Port: 8000  │
│              │ │             │ │                    │ │             │
│   Features:  │ │  Features:  │ │    Features:       │ │  Features:  │
│ • JWT Auth   │ │ • Profiles  │ │ • WebSocket        │ │ • Geocoding │
│ • Register   │ │ • Settings  │ │ • Real-time chat   │ │ • Search    │
│ • Login      │ │ • Social    │ │ • Redis pub/sub    │ │ • Spatial   │
└──────┬───────┘ └──────┬──────┘ └─────────┬──────────┘ └──────┬──────┘
       │                │                   │                   │
       ▼                ▼                   ▼                   ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ ┌─────────────┐
│ PostgreSQL  │ │ PostgreSQL  │ │     MongoDB     │ │  PostGIS    │
│   (Auth)    │ │   (Users)   │ │     (Chat)      │ │ (Addresses) │
│ Port: 5432  │ │ Port: 5432  │ │  Port: 27017    │ │ Port: 5433  │
└─────────────┘ └─────────────┘ └────────┬────────┘ └─────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │      Redis      │
                                │    (Pub/Sub)    │
                                │   Port: 6379    │
                                └─────────────────┘
```

## 🚀 Key Features

- **Real-time Location-Based Chat**: Join chat rooms based on your current GPS location
- **Address Search**: Search for and join chat rooms at specific addresses
- **WebSocket Communication**: Real-time messaging with instant updates
- **Redis Pub/Sub**: Scalable message broadcasting across chat rooms
- **JWT Authentication**: Secure user authentication and session management
- **Geospatial Queries**: Find nearby locations using PostGIS
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development
- **React Router** for navigation
- **WebSocket** for real-time communication
- **Tailwind CSS** for styling

### Backend Services
- **Auth Service** (Go): JWT authentication, user registration/login
- **User Service** (Node.js): User profile management
- **Chat Service** (Rust): WebSocket handling, message routing, Redis pub/sub
- **Address Service** (Python): Geocoding, address search, spatial queries

### Infrastructure
- **Docker** & **Docker Compose** for containerization
- **Nginx** for reverse proxy and load balancing
- **PostgreSQL** for relational data
- **PostGIS** for geospatial data
- **MongoDB** for chat messages
- **Redis** for pub/sub messaging
- **RabbitMQ** for event-driven communication (optional)

## 🚦 Quick Start

### Prerequisites
- Docker Desktop installed and running
- At least 4GB of RAM allocated to Docker
- Ports 80, 3001, 3002, 5432, 5433, 6379, 8000, 8080, 27017 available

### 1. Clone and Setup
```bash
git clone <repository>
cd tap_in
```

### 2. Build and Run

**Production Mode:**
```bash
# Build all images
make build

# Start all services
make up

# View logs
make logs
```

**Development Mode (with hot reload):**
```bash
# Start in dev mode
make dev
```

### 3. Access the Application

- **Frontend**: http://localhost (or http://localhost:3080 in dev mode)
- **Auth API**: http://localhost:8080
- **User API**: http://localhost:3002  
- **Chat API**: http://localhost:3001
- **Address API**: http://localhost:8000

### 4. Stop Services
```bash
make down
```

## 📁 Project Structure

```
tap_in/
├── frontend/          # React frontend application
├── auth/             # Go authentication service
├── user/             # Node.js user management service
├── chat/             # Rust WebSocket chat service
├── address/          # Python geocoding service
├── nginx/            # Nginx configuration
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
└── README.md
```

## 🔐 Authentication Flow

1. User registers/logs in through the frontend
2. Auth service validates credentials and issues JWT
3. Frontend stores JWT and includes it in API requests
4. Services validate JWT for protected endpoints

## 💬 Chat Flow

1. User clicks "Find Nearby Chats" or searches for an address
2. Frontend requests user's geolocation (or uses address coordinates)
3. User is connected to a location-based chat room (format: `latitude_longitude`)
4. WebSocket connection established with Chat service
5. Messages are broadcast to all users in the same location via Redis pub/sub

## 🗺️ Location Services

- **Browser Geolocation**: Uses HTML5 Geolocation API for current position
- **Address Search**: Geocoding service converts addresses to coordinates
- **Spatial Queries**: PostGIS finds nearby locations within a radius
- **Location Format**: Chat rooms use `latitude_longitude` format (e.g., `40.7128_-74.0060`)

## 🔧 Environment Variables

Default environment variables are set in `docker-compose.yml`. For production:

1. Copy `.env.docker` to `.env`
2. Update with production values:

```env
# JWT Configuration
JWT_SECRET=your-secret-key

# Database Passwords
POSTGRES_PASSWORD=secure-password
MONGO_PASSWORD=secure-password

# API Keys
GOOGLE_MAPS_API_KEY=your-api-key

# Service URLs (for production)
AUTH_SERVICE_URL=http://auth:8080
USER_SERVICE_URL=http://user:3002
CHAT_SERVICE_URL=http://chat:3001
ADDRESS_SERVICE_URL=http://address:8000
```

## 📊 Monitoring

- Service health checks available at `/health` endpoints
- Individual service logs:
  ```bash
  make logs-auth
  make logs-user
  make logs-chat
  make logs-address
  make logs-frontend
  ```
- Redis monitoring: `docker exec -it tap_in-redis-1 redis-cli monitor`

## 🧪 Testing

```bash
# Integration tests
make test

# Service-specific tests
docker-compose exec auth go test ./...
docker-compose exec user npm test
docker-compose exec chat cargo test
docker-compose exec address pytest
```

## 🗄️ Database Access

```bash
# Auth/User database
make db-auth
make db-user

# Address database (PostGIS)
make db-address

# MongoDB shell
docker-compose exec mongodb mongosh -u admin -p admin
```

## 🚨 Troubleshooting

### Port Conflicts
If you get port binding errors:
```bash
lsof -i :8080,3001,3002,8000,5432,6379,27017
```

### Database Connection Issues
Ensure databases are healthy:
```bash
docker-compose ps
make logs
```

### Clean Start
Remove all containers and volumes:
```bash
make clean
make build
make up
```

## 🚀 Production Deployment

For production deployment:

1. Use environment-specific `.env` files
2. Enable SSL/TLS termination
3. Use managed databases (RDS, Cloud SQL, etc.)
4. Configure proper secrets management
5. Set up monitoring and logging
6. Use container orchestration (Kubernetes, ECS, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.# TapIn2025
