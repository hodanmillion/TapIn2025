# Location Chat Application

A full-stack location-based chat application with microservices architecture.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Auth Service**: Go + PostgreSQL + Redis
- **User Service**: Node.js + TypeScript + PostgreSQL + Redis
- **Chat Service**: Rust + MongoDB + Redis
- **Address Service**: Python + PostGIS + Redis

## Quick Start with Docker

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

- **Frontend**: http://localhost
- **Auth API**: http://localhost:8080
- **User API**: http://localhost:3002  
- **Chat API**: http://localhost:3001
- **Address API**: http://localhost:8000

### 4. Stop Services
```bash
make down
```

## Services Overview

### Frontend (Port 80/5173)
- React SPA with location-based chat
- Real-time WebSocket connections
- Google Maps integration (requires API key)

### Auth Service (Port 8080)
- User registration and login
- JWT token management
- Email verification
- Password reset

### User Service (Port 3002)
- User profiles
- Social features (follow/unfollow)
- Avatar uploads
- Settings management

### Chat Service (Port 3001)
- Real-time messaging
- Location-based chat rooms
- WebSocket connections
- Message history

### Address Service (Port 8000)
- Address search and geocoding
- Spatial queries
- Location management
- PostGIS integration

## Database Access

```bash
# Auth/User database
make db-auth
make db-user

# Address database (PostGIS)
make db-address

# MongoDB shell
docker-compose exec mongodb mongosh -u admin -p admin
```

## Environment Variables

Default environment variables are set in `docker-compose.yml`. For production:

1. Copy `.env.docker` to `.env`
2. Update with production values:
   - JWT_SECRET
   - Database passwords
   - Google Maps API key
   - AWS credentials (for S3)

## Development

### Hot Reload
The development compose file mounts local directories for hot reload:

```bash
make dev
```

Changes to source code will automatically reload services.

### Individual Service Logs
```bash
make logs-auth
make logs-user
make logs-chat
make logs-address
make logs-frontend
```

### Running Tests
```bash
# Integration tests
make test

# Service-specific tests
docker-compose exec auth go test ./...
docker-compose exec user npm test
docker-compose exec chat cargo test
docker-compose exec address pytest
```

## Troubleshooting

### Port Conflicts
If you get port binding errors, check for running services:
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

## Production Deployment

For production deployment:

1. Use environment-specific `.env` files
2. Enable SSL/TLS termination
3. Use managed databases (RDS, Cloud SQL, etc.)
4. Configure proper secrets management
5. Set up monitoring and logging
6. Use container orchestration (Kubernetes, ECS, etc.)

## Architecture Diagram

```
┌─────────────┐
│   Frontend  │
│   (React)   │
└──────┬──────┘
       │
┌──────┴──────────────────────────────┐
│          Nginx Reverse Proxy        │
└─────────────────────────────────────┘
       │         │         │         │
┌──────┴───┐┌────┴───┐┌────┴───┐┌────┴───┐
│   Auth   ││  User  ││  Chat  ││Address │
│   (Go)   ││(Node)  ││ (Rust) ││(Python)│
└────┬─────┘└────┬───┘└────┬───┘└────┬───┘
     │           │          │         │
┌────┴───────────┴──────────┴─────────┴───┐
│              Shared Services            │
│  PostgreSQL │ Redis │ MongoDB │ PostGIS │
└─────────────────────────────────────────┘
```