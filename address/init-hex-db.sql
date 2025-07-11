-- Create hex tables for address service
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hex_cells (
    h3_index VARCHAR(20) PRIMARY KEY,
    resolution INTEGER NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    display_name VARCHAR(255),
    locality VARCHAR(255),
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_hex_locations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    h3_index VARCHAR(20) NOT NULL REFERENCES hex_cells(h3_index),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, h3_index)
);

CREATE TABLE IF NOT EXISTS hex_landmarks (
    id SERIAL PRIMARY KEY,
    h3_index VARCHAR(20) NOT NULL REFERENCES hex_cells(h3_index),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hex_cells_resolution ON hex_cells(resolution);
CREATE INDEX IF NOT EXISTS idx_user_hex_locations_user_id ON user_hex_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hex_locations_h3_index ON user_hex_locations(h3_index);
CREATE INDEX IF NOT EXISTS idx_hex_landmarks_h3_index ON hex_landmarks(h3_index);
EOF < /dev/null