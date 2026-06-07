const db = require('./db');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    // Check if users exist
    const userCount = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('Database already has data. Skipping seeder.');
      return;
    }

    console.log('Seeding database with default RationX PDS data...');

    // 1. Create Hashed Passwords
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    const driverHash = await bcrypt.hash('driver123', 10);
    const driver2Hash = await bcrypt.hash('driver456', 10);
    const ownerHash = await bcrypt.hash('fps123', 10);

    // 2. Insert Users
    const adminRes = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES 
      ('Super Admin', 'admin@rationx.gov.in', $1, 'super_admin') RETURNING id`,
      [adminHash]
    );

    const managerRes = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES 
      ('Chennai Warehouse Manager', 'manager@rationx.gov.in', $1, 'warehouse_manager') RETURNING id`,
      [managerHash]
    );

    const driverRes = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES 
      ('Rajesh Kumar (Driver)', 'driver@rationx.gov.in', $1, 'driver') RETURNING id`,
      [driverHash]
    );

    const driver2Res = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES 
      ('Arun Singh (Driver)', 'driver2@rationx.gov.in', $1, 'driver') RETURNING id`,
      [driver2Hash]
    );

    const ownerRes = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES 
      ('Annanagar FPS Owner', 'fps@rationx.gov.in', $1, 'fps_owner') RETURNING id`,
      [ownerHash]
    );

    const driverId = driverRes.rows[0].id;
    const driver2Id = driver2Res.rows[0].id;

    // 3. Insert Warehouses
    const w1 = await db.query(
      `INSERT INTO warehouses (warehouse_name, location_lat, location_lng, address) VALUES 
      ('Central PDS Warehouse Chennai', 13.0827, 80.2707, 'Poonamallee High Road, Chennai, Tamil Nadu') RETURNING id`
    );

    const w2 = await db.query(
      `INSERT INTO warehouses (warehouse_name, location_lat, location_lng, address) VALUES 
      ('Madurai Grain Silo', 9.9252, 78.1198, 'Melur Main Road, Madurai, Tamil Nadu') RETURNING id`
    );

    const warehouse1Id = w1.rows[0].id;
    const warehouse2Id = w2.rows[0].id;

    // 4. Insert Vehicles
    await db.query(
      `INSERT INTO vehicles (vehicle_number, driver_id, status) VALUES 
      ('TN-01-AX-9999', $1, 'idle')`,
      [driverId]
    );

    await db.query(
      `INSERT INTO vehicles (vehicle_number, driver_id, status) VALUES 
      ('TN-58-BY-8888', $1, 'idle')`,
      [driver2Id]
    );

    // 5. Insert Fair Price Shops (FPS)
    const fps1 = await db.query(
      `INSERT INTO fair_price_shops (shop_name, location_lat, location_lng, address, owner_name, contact) VALUES 
      ('Chennai Annanagar PDS Shop #42', 13.0878, 80.2173, 'Block 5, Annanagar East, Chennai, Tamil Nadu', 'Annanagar FPS Owner', '+919876543210') RETURNING id`
    );

    const fps2 = await db.query(
      `INSERT INTO fair_price_shops (shop_name, location_lat, location_lng, address, owner_name, contact) VALUES 
      ('Madurai Mattuthavani PDS Shop #09', 9.9452, 78.1565, 'Mattuthavani Bus Stand Area, Madurai, Tamil Nadu', 'Manoj Kumar', '+919988776655') RETURNING id`
    );

    // 6. Seed Inventory for Warehouses
    const products = ['Rice', 'Wheat', 'Sugar', 'Pulses', 'Kerosene'];
    const warehouses = [warehouse1Id, warehouse2Id];

    for (const whId of warehouses) {
      for (const product of products) {
        let initialQty = product === 'Kerosene' ? 1500.0 : 6000.0;
        await db.query(
          'INSERT INTO inventory (warehouse_id, product_name, quantity) VALUES ($1, $2, $3)',
          [whId, product, initialQty]
        );
        await db.query(
          'INSERT INTO inventory_history (warehouse_id, product_name, change_type, quantity_changed, remaining_quantity) VALUES ($1, $2, $3, $4, $5)',
          [whId, product, 'add', initialQty, initialQty]
        );
      }
    }

    console.log('RationX database seeding completed successfully.');
  } catch (error) {
    console.error('Seeding database error:', error);
  }
};

module.exports = seedDatabase;
