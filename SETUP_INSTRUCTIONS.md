# Setup Instructions for New Environment

## Quick Setup

Run these commands from the project root directory:

```bash
# 1. Start all services
docker-compose up -d

# 2. Wait for PostGIS to be healthy (about 10 seconds)
sleep 10

# 3. Create the hex database
docker-compose exec postgis psql -U postgres -c "CREATE DATABASE IF NOT EXISTS address_hex_db;"

# 4. Apply the hex database schema
docker-compose exec postgis psql -U postgres -d address_hex_db < address/init-hex-db.sql

# 5. Restart the address service
docker-compose restart address
```

## Alternative: One-liner Setup

```bash
docker-compose up -d && sleep 10 && \
docker-compose exec postgis psql -U postgres -c "CREATE DATABASE IF NOT EXISTS address_hex_db;" && \
docker-compose exec postgis psql -U postgres -d address_hex_db < address/init-hex-db.sql && \
docker-compose restart address
```

## Verify Everything is Running

```bash
# Check all services are running
docker-compose ps

# Check address service logs
docker-compose logs address --tail=20
```

## Common Issues

### If address service still fails:
1. Check if the database was created:
   ```bash
   docker-compose exec postgis psql -U postgres -l | grep address_hex_db
   ```

2. Check if tables exist:
   ```bash
   docker-compose exec postgis psql -U postgres -d address_hex_db -c "\dt"
   ```

3. If tables don't exist, run the schema manually:
   ```bash
   docker-compose exec -T postgis psql -U postgres -d address_hex_db < address/init-hex-db.sql
   ```

### If you get "database does not exist" error:
The docker-compose.yml might be pointing to the wrong database. Update line 157:
```yaml
DATABASE_URL: "postgresql+asyncpg://postgres:postgres@postgis:5432/address_hex_db"
```

## Full Clean Start (if needed)

```bash
# Stop and remove all containers
docker-compose down -v

# Start fresh
docker-compose up -d

# Run setup commands above
```