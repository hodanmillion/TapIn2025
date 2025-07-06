.PHONY: help build up down logs ps clean dev prod test quick-start

# Default target
help:
	@echo "Location Chat Application - Docker Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build    - Build all Docker images"
	@echo "  make up       - Start all services in production mode"
	@echo "  make dev      - Start all services in development mode with hot reload"
	@echo "  make down     - Stop all services"
	@echo "  make logs     - View logs from all services"
	@echo "  make ps       - List running containers"
	@echo "  make clean    - Remove all containers, networks, and volumes"
	@echo "  make test     - Run integration tests"
	@echo ""
	@echo "Service-specific commands:"
	@echo "  make logs-auth     - View auth service logs"
	@echo "  make logs-user     - View user service logs"
	@echo "  make logs-chat     - View chat service logs"
	@echo "  make logs-address  - View address service logs"
	@echo "  make logs-frontend - View frontend logs"
	@echo ""
	@echo "Quick start:"
	@echo "  make quick-start - Build and start everything with health checks"

# Build all images
build:
	docker-compose build

# Start in production mode
up:
	docker-compose up -d
	@echo "Services starting..."
	@echo "Frontend: http://localhost"
	@echo "Auth API: http://localhost:8080"
	@echo "User API: http://localhost:3002"
	@echo "Chat API: http://localhost:3001"
	@echo "Address API: http://localhost:8000"

# Start in development mode with hot reload
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# List containers
ps:
	docker-compose ps

# Clean everything
clean:
	docker-compose down -v
	docker system prune -f

# Service-specific logs
logs-auth:
	docker-compose logs -f auth

logs-user:
	docker-compose logs -f user

logs-chat:
	docker-compose logs -f chat

logs-address:
	docker-compose logs -f address

logs-frontend:
	docker-compose logs -f frontend

# Database access
db-auth:
	docker-compose exec postgres psql -U postgres -d auth_db

db-user:
	docker-compose exec postgres psql -U postgres -d user_db

db-address:
	docker-compose exec postgis psql -U postgres -d address_db

# Run tests
test:
	@echo "Running integration tests..."
	docker-compose up -d
	@echo "Waiting for services to start..."
	@sleep 15
	@./scripts/health-check.sh

# Health check
health:
	@./scripts/health-check.sh

# Quick start - build and run with health checks
quick-start:
	@./scripts/quick-start.sh