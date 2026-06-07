const db = require('../models/db');

// --- WAREHOUSE CONTROLLERS ---

exports.getWarehouses = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM warehouses ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ message: 'Server error retrieving warehouses.' });
  }
};

exports.addWarehouse = async (req, res) => {
  const { warehouse_name, location_lat, location_lng, address } = req.body;
  if (!warehouse_name || !location_lat || !location_lng || !address) {
    return res.status(400).json({ message: 'All warehouse fields are required.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO warehouses (warehouse_name, location_lat, location_lng, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [warehouse_name, location_lat, location_lng, address]
    );

    // Auto-seed inventory for this warehouse
    const products = ['Rice', 'Wheat', 'Sugar', 'Pulses', 'Kerosene'];
    for (const product of products) {
      await db.query(
        'INSERT INTO inventory (warehouse_id, product_name, quantity) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [result.rows[0].id, product, 5000.0] // Default starting stock of 5000 units
      );
      await db.query(
        'INSERT INTO inventory_history (warehouse_id, product_name, change_type, quantity_changed, remaining_quantity) VALUES ($1, $2, $3, $4, $5)',
        [result.rows[0].id, product, 'add', 5000.0, 5000.0]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add warehouse error:', error);
    res.status(500).json({ message: 'Server error adding warehouse.' });
  }
};

// --- VEHICLE CONTROLLERS ---

exports.getVehicles = async (req, res) => {
  try {
    const queryText = `
      SELECT v.*, u.name as driver_name, u.email as driver_email 
      FROM vehicles v 
      LEFT JOIN users u ON v.driver_id = u.id 
      ORDER BY v.id ASC
    `;
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ message: 'Server error retrieving vehicles.' });
  }
};

exports.addVehicle = async (req, res) => {
  const { vehicle_number, driver_id } = req.body;
  if (!vehicle_number) {
    return res.status(400).json({ message: 'Vehicle number is required.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO vehicles (vehicle_number, driver_id) VALUES ($1, $2) RETURNING *',
      [vehicle_number, driver_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add vehicle error:', error);
    res.status(500).json({ message: 'Server error adding vehicle.' });
  }
};

exports.getAvailableDrivers = async (req, res) => {
  try {
    // Return drivers that are not already assigned to a vehicle
    const queryText = `
      SELECT id, name, email FROM users 
      WHERE role = 'driver' AND id NOT IN (
        SELECT driver_id FROM vehicles WHERE driver_id IS NOT NULL
      )
    `;
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Get available drivers error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// --- FAIR PRICE SHOP (FPS) CONTROLLERS ---

exports.getFairPriceShops = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM fair_price_shops ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Get FPS error:', error);
    res.status(500).json({ message: 'Server error retrieving shops.' });
  }
};

exports.addFairPriceShop = async (req, res) => {
  const { shop_name, location_lat, location_lng, address, owner_name, contact } = req.body;
  if (!shop_name || !location_lat || !location_lng || !address || !owner_name || !contact) {
    return res.status(400).json({ message: 'All shop fields are required.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO fair_price_shops (shop_name, location_lat, location_lng, address, owner_name, contact) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [shop_name, location_lat, location_lng, address, owner_name, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add FPS error:', error);
    res.status(500).json({ message: 'Server error adding shop.' });
  }
};
