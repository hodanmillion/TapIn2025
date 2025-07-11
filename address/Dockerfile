# Python base image
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gdal-bin \
    libgdal-dev \
    postgresql-client \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL environment variables
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy entrypoint and migration files
COPY entrypoint.sh .
COPY alembic.ini .
COPY alembic ./alembic
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 8000

# Use the entrypoint script
CMD ["./entrypoint.sh"]