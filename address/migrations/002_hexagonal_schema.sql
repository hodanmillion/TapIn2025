-- Drop old coordinate-based tables
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- H3 Hexagonal Cell System Tables
CREATE TABLE hex_cells (
    h3_index VARCHAR(15) PRIMARY KEY,
    resolution SMALLINT NOT NULL,
    center_lat DECIMAL(10, 8) NOT NULL,
    center_lng DECIMAL(11, 8) NOT NULL,
    -- Neighborhood info
    display_name VARCHAR(255),
    locality VARCHAR(255),
    region VARCHAR(255),
    country_code VARCHAR(2),
    -- Activity tracking
    active_users INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on center point
CREATE INDEX idx_hex_cells_center ON hex_cells USING GIST (
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)
);

-- Index for activity queries
CREATE INDEX idx_hex_cells_activity ON hex_cells(last_activity DESC, active_users DESC);
CREATE INDEX idx_hex_cells_resolution ON hex_cells(resolution);

-- User location tracking (which hex they're in)
CREATE TABLE user_hex_locations (
    user_id UUID NOT NULL,
    h3_index VARCHAR(15) NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, h3_index),
    FOREIGN KEY (h3_index) REFERENCES hex_cells(h3_index)
);

-- Hex cell relationships (for navigation between cells)
CREATE TABLE hex_neighbors (
    h3_index VARCHAR(15) NOT NULL,
    neighbor_h3_index VARCHAR(15) NOT NULL,
    direction VARCHAR(20), -- 'north', 'northeast', etc.
    PRIMARY KEY (h3_index, neighbor_h3_index),
    FOREIGN KEY (h3_index) REFERENCES hex_cells(h3_index),
    FOREIGN KEY (neighbor_h3_index) REFERENCES hex_cells(h3_index)
);

-- Known places within hex cells (for naming/reference)
CREATE TABLE hex_landmarks (
    id SERIAL PRIMARY KEY,
    h3_index VARCHAR(15) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50), -- 'neighborhood', 'landmark', 'business'
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    FOREIGN KEY (h3_index) REFERENCES hex_cells(h3_index)
);

-- Pre-computed hex resolutions for different zoom levels
CREATE TABLE hex_resolution_hierarchy (
    child_h3 VARCHAR(15) NOT NULL,
    parent_h3 VARCHAR(15) NOT NULL,
    resolution_diff SMALLINT NOT NULL,
    PRIMARY KEY (child_h3, parent_h3)
);

-- Function to get or create hex cell
CREATE OR REPLACE FUNCTION get_or_create_hex_cell(
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    res SMALLINT DEFAULT 8
) RETURNS hex_cells AS $$
DECLARE
    h3_id VARCHAR(15);
    hex_record hex_cells;
BEGIN
    -- Note: This would use H3 function in real implementation
    -- For now, using placeholder
    h3_id := 'hex_' || res || '_' || ROUND(lat::numeric, 3) || '_' || ROUND(lng::numeric, 3);
    
    -- Try to get existing
    SELECT * INTO hex_record FROM hex_cells WHERE h3_index = h3_id;
    
    IF NOT FOUND THEN
        -- Create new hex cell
        INSERT INTO hex_cells (h3_index, resolution, center_lat, center_lng)
        VALUES (h3_id, res, lat, lng)
        RETURNING * INTO hex_record;
    END IF;
    
    RETURN hex_record;
END;
$$ LANGUAGE plpgsql;