# Address Service with PostGIS

A FastAPI-based address service with spatial analysis capabilities using PostGIS.

## Features

- 🗺️ **PostGIS Integration** - Full spatial database support with geometry operations
- 🔍 **Geocoding** - Google Maps and OpenStreetMap (Nominatim) providers
- 📍 **Spatial Analysis** - Clustering, heatmaps, nearest neighbor search
- 🚀 **FastAPI** - Modern async Python web framework
- 🐳 **Docker Ready** - PostgreSQL + PostGIS with Docker Compose

## Quick Start

### 1. Start Database Services

```bash
# Start PostgreSQL with PostGIS and Redis
docker-compose up -d
```

### 2. Install Dependencies

```bash
# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate
uv pip install -e .
```

### 3. Run the Application

```bash
# Run with automatic database initialization
python run.py
```

The service will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

## API Endpoints

### Address Operations
- `POST /api/v1/addresses/search` - Search for addresses
- `POST /api/v1/addresses/detail` - Get address details
- `POST /api/v1/addresses/nearby` - Find nearby locations
- `POST /api/v1/addresses/batch` - Batch create addresses

### Spatial Analysis
- `POST /api/v1/spatial/analyze` - Spatial distribution analysis
- `POST /api/v1/spatial/search/polygon` - Search within polygon
- `POST /api/v1/spatial/heatmap` - Generate heatmap
- `GET /api/v1/spatial/map/{location_id}` - Location map
- `POST /api/v1/spatial/nearest` - Find nearest locations

### Health & Monitoring
- `GET /health/` - Basic health check
- `GET /health/ready` - Readiness check (database + Redis)
- `GET /metrics` - Prometheus metrics

## Configuration

Create a `.env` file or set environment variables:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/addressdb

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# API Keys (optional)
GOOGLE_MAPS_API_KEY=your-api-key

# Server
PORT=8000
DEBUG=true

# Security
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=["*"]
```

## PostGIS Benefits

With PostGIS geometry support, you get:

- **Accurate spatial queries** using geographic projections
- **High-performance spatial indexing** with GiST indexes
- **Advanced spatial functions** like buffering, intersection, distance calculations
- **Standards compliance** with OGC spatial standards
- **Scalability** for large spatial datasets

## Development

### Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head
```

### Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=src
```

### Code Quality

```bash
# Format code
black src/
ruff check src/ --fix

# Type checking
mypy src/
```

## Architecture

```
src/
├── main.py              # FastAPI application
├── config.py            # Configuration settings
├── database.py          # Database models & connection
├── models.py            # Pydantic schemas
├── auth.py              # Authentication
├── middleware.py        # Custom middleware
├── services/
│   ├── address_service.py    # Address operations
│   ├── geocoding.py          # Geocoding providers
│   └── spatial_service.py    # Spatial analysis
└── routers/
    ├── addresses.py          # Address endpoints
    ├── spatial_analysis.py   # Spatial endpoints
    └── health.py             # Health endpoints
```

## Spatial Features

### Clustering
Find spatial clusters of locations using DBSCAN algorithm with geographic distance.

### Heatmaps
Generate density heatmaps using H3 hexagonal indexing system.

### Nearest Neighbor
Fast spatial search using PostGIS spatial indexes.

### Service Areas
Calculate coverage areas with buffering and union operations.

## License

MIT License