-- Database schema for RationX - PDS Ration Supply Chain Monitoring System

-- Drop tables if they exist
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS inventory_history CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS tracking_logs CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS fair_price_shops CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'warehouse_manager', 'driver', 'fps_owner')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Warehouses Table
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(255) NOT NULL,
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    address VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles Table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    driver_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'transit')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fair Price Shops (FPS) Table
CREATE TABLE fair_price_shops (
    id SERIAL PRIMARY KEY,
    shop_name VARCHAR(255) NOT NULL,
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    address VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments Table
CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
    fps_id INT REFERENCES fair_price_shops(id) ON DELETE CASCADE,
    product_name VARCHAR(100) NOT NULL,
    quantity_dispatched DOUBLE PRECISION NOT NULL,
    quantity_received DOUBLE PRECISION,
    shortage_reported DOUBLE PRECISION DEFAULT 0,
    dispatch_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery TIMESTAMP NOT NULL,
    actual_delivery TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'delayed', 'cancelled')),
    otp_code VARCHAR(10) NOT NULL,
    verification_code VARCHAR(10),
    digital_signature TEXT,
    delivery_proof_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracking Logs (GPS Telemetry) Table
CREATE TABLE tracking_logs (
    id SERIAL PRIMARY KEY,
    shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts Table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- 'route_deviation', 'long_stop', 'delay', 'quantity_mismatch', 'duplicate_stock'
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    details TEXT,
    risk_score DOUBLE PRECISION DEFAULT 0,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Table
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    product_name VARCHAR(100) NOT NULL, -- 'Rice', 'Wheat', 'Sugar', 'Pulses', 'Kerosene'
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (warehouse_id, product_name)
);

-- Inventory History (Stock Logs) Table
CREATE TABLE inventory_history (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    product_name VARCHAR(100) NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('add', 'dispatch', 'update')),
    quantity_changed DOUBLE PRECISION NOT NULL,
    remaining_quantity DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL, -- 'pdf', 'excel'
    district VARCHAR(100),
    state VARCHAR(100),
    file_path VARCHAR(255) NOT NULL,
    generated_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
