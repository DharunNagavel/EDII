const db = require('../models/db');
const socketService = require('../services/socketService');
const aiService = require('../services/aiService');

// Helper to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
};

exports.createShipment = async (req, res) => {
  const { warehouse_id, vehicle_id, fps_id, product_name, quantity_dispatched, expected_delivery } = req.body;

  if (!warehouse_id || !vehicle_id || !fps_id || !product_name || !quantity_dispatched || !expected_delivery) {
    return res.status(400).json({ message: 'All shipment fields are required.' });
  }

  const numericQty = parseFloat(quantity_dispatched);
  if (isNaN(numericQty) || numericQty <= 0) {
    return res.status(400).json({ message: 'Quantity dispatched must be greater than zero.' });
  }

  try {
    // Start transactional check and deduction
    await db.query('BEGIN');

    // 1. Check warehouse inventory levels
    const inventoryRes = await db.query(
      'SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_name = $2',
      [warehouse_id, product_name]
    );

    if (inventoryRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ message: `No stock of ${product_name} found in this warehouse.` });
    }

    const currentQty = parseFloat(inventoryRes.rows[0].quantity);
    if (currentQty < numericQty) {
      await db.query('ROLLBACK');
      return res.status(400).json({ message: `Insufficient stock of ${product_name}. Available: ${currentQty}, Requested: ${numericQty}.` });
    }

    // 2. Verify vehicle is idle
    const vehicleRes = await db.query('SELECT status FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ message: 'Vehicle not found.' });
    }

    if (vehicleRes.rows[0].status !== 'idle') {
      await db.query('ROLLBACK');
      return res.status(400).json({ message: 'Vehicle is currently in transit.' });
    }

    // 3. Deduct stock from inventory
    const newQty = currentQty - numericQty;
    await db.query(
      'UPDATE inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE warehouse_id = $2 AND product_name = $3',
      [newQty, warehouse_id, product_name]
    );

    // 4. Log in inventory history
    await db.query(
      'INSERT INTO inventory_history (warehouse_id, product_name, change_type, quantity_changed, remaining_quantity) VALUES ($1, $2, $3, $4, $5)',
      [warehouse_id, product_name, 'dispatch', -numericQty, newQty]
    );

    // 5. Update vehicle status to transit
    await db.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['transit', vehicle_id]);

    // 6. Create shipment record
    const otp = generateOTP();
    const result = await db.query(
      `INSERT INTO shipments (warehouse_id, vehicle_id, fps_id, product_name, quantity_dispatched, expected_delivery, status, otp_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [warehouse_id, vehicle_id, fps_id, product_name, numericQty, expected_delivery, 'pending', otp]
    );

    await db.query('COMMIT');

    const createdShipment = result.rows[0];
    socketService.emitShipmentUpdate(createdShipment);

    res.status(201).json({
      message: 'Shipment created and dispatched successfully. Stock deducted.',
      shipment: createdShipment
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Create shipment error:', error);
    res.status(500).json({ message: 'Server error creating shipment.' });
  }
};

exports.getShipments = async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let queryText = `
      SELECT s.*, 
             w.warehouse_name, w.address as warehouse_address,
             v.vehicle_number, v.driver_id,
             u.name as driver_name,
             fps.shop_name, fps.address as fps_address, fps.owner_name as fps_owner_name
      FROM shipments s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      JOIN fair_price_shops fps ON s.fps_id = fps.id
    `;

    const queryParams = [];

    // Filter shipments according to role
    if (role === 'warehouse_manager') {
      // Find warehouses managed by this user
      // Note: For simplicity of the setup, warehouse managers can access all warehouses or can see shipments from all.
      // Let's filter if there's a specific warehouse manager mapping, or let them see all for demo admin purposes,
      // but let's filter if a manager is associated with shipments. Let's see if we want to restrict. 
      // For now, let's return all, or if you want, keep it general.
    } else if (role === 'driver') {
      // Driver sees only shipments assigned to their vehicle where driver_id is their userId
      queryText += ` WHERE v.driver_id = $1`;
      queryParams.push(userId);
    } else if (role === 'fps_owner') {
      // FPS Owner sees shipments bound for their FPS
      // In a real system, the FPS owner has a specific shop mapping. Let's lookup their shop first or map by email.
      // Let's query by owner email or let them search. Let's map owner_name/contact, or just fetch shops.
      // Let's check if the shop's owner_name matches the user's name:
      const shopRes = await db.query('SELECT id FROM fair_price_shops WHERE owner_name = $1', [req.user.name]);
      if (shopRes.rows.length > 0) {
        const shopIds = shopRes.rows.map(r => r.id);
        queryText += ` WHERE s.fps_id = ANY($1::int[])`;
        queryParams.push(shopIds);
      } else {
        // Fallback: If no direct match by name, let them see all bound shipments for demo purposes
      }
    }

    queryText += ` ORDER BY s.id DESC`;

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ message: 'Server error retrieving shipments.' });
  }
};

exports.getShipmentById = async (req, res) => {
  const { id } = req.params;
  try {
    const shipmentQuery = `
      SELECT s.*, 
             w.warehouse_name, w.location_lat as w_lat, w.location_lng as w_lng, w.address as warehouse_address,
             v.vehicle_number, v.driver_id,
             u.name as driver_name,
             fps.shop_name, fps.location_lat as fps_lat, fps.location_lng as fps_lng, fps.address as fps_address, fps.owner_name as fps_owner_name
      FROM shipments s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      JOIN fair_price_shops fps ON s.fps_id = fps.id
      WHERE s.id = $1
    `;
    const shipmentRes = await db.query(shipmentQuery, [id]);
    if (shipmentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found.' });
    }

    const shipment = shipmentRes.rows[0];

    // Fetch tracking logs
    const logsRes = await db.query(
      'SELECT * FROM tracking_logs WHERE shipment_id = $1 ORDER BY timestamp ASC',
      [id]
    );

    // Fetch alerts
    const alertsRes = await db.query(
      'SELECT * FROM alerts WHERE shipment_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      shipment,
      tracking_logs: logsRes.rows,
      alerts: alertsRes.rows
    });
  } catch (error) {
    console.error('Get shipment detail error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateShipmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'in_transit', 'delayed', 'cancelled'

  if (!status) {
    return res.status(400).json({ message: 'Status is required.' });
  }

  try {
    let updateQuery = 'UPDATE shipments SET status = $1';
    const params = [status, id];

    if (status === 'in_transit') {
      updateQuery += ', dispatch_time = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = $2 RETURNING *';

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found.' });
    }

    const updatedShipment = result.rows[0];

    // If cancelled, return vehicle to idle
    if (status === 'cancelled') {
      await db.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['idle', updatedShipment.vehicle_id]);
    }

    socketService.emitShipmentUpdate(updatedShipment);

    res.json({
      message: `Shipment status updated to ${status}.`,
      shipment: updatedShipment
    });
  } catch (error) {
    console.error('Update shipment status error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.confirmDelivery = async (req, res) => {
  const { id } = req.params;
  const { otp_code, quantity_received, shortage_reported, digital_signature, delivery_proof_image } = req.body;

  if (!otp_code || quantity_received === undefined) {
    return res.status(400).json({ message: 'OTP code and quantity received are required.' });
  }

  try {
    // 1. Fetch shipment details
    const shipmentRes = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
    if (shipmentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Shipment not found.' });
    }

    const shipment = shipmentRes.rows[0];

    if (shipment.status === 'delivered') {
      return res.status(400).json({ message: 'Shipment has already been delivered.' });
    }

    // 2. Validate OTP
    if (shipment.otp_code !== otp_code) {
      return res.status(400).json({ message: 'Invalid OTP code. Access denied.' });
    }

    const qtyDispatched = parseFloat(shipment.quantity_dispatched);
    const qtyReceived = parseFloat(quantity_received);
    const shortage = parseFloat(shortage_reported) || (qtyDispatched - qtyReceived);

    // 3. Complete Transaction
    await db.query('BEGIN');

    // Update shipment details
    const updateShipmentRes = await db.query(
      `UPDATE shipments 
       SET status = 'delivered', 
           quantity_received = $1, 
           shortage_reported = $2, 
           verification_code = $3,
           digital_signature = $4,
           delivery_proof_image = $5,
           actual_delivery = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [qtyReceived, shortage > 0 ? shortage : 0, otp_code, digital_signature || null, delivery_proof_image || null, id]
    );

    const updatedShipment = updateShipmentRes.rows[0];

    // Release vehicle back to idle
    await db.query('UPDATE vehicles SET status = $1 WHERE id = $2', ['idle', shipment.vehicle_id]);

    await db.query('COMMIT');

    socketService.emitShipmentUpdate(updatedShipment);

    // 4. Anomaly Check: Check for quantity mismatch
    const mismatchPct = qtyDispatched > 0 ? (Math.abs(qtyDispatched - qtyReceived) / qtyDispatched) : 0;
    
    if (qtyReceived < qtyDispatched) {
      // Trigger AI service check for quantity mismatch anomaly
      const features = {
        route_deviation_km: 0.0, // Quantity mismatch context
        stop_duration_hrs: 0.0,
        delay_hours: 0.0,
        quantity_mismatch_pct: mismatchPct
      };

      const aiResponse = await aiService.predictAnomaly(features);
      const isAnomaly = aiResponse ? aiResponse.is_anomaly : (mismatchPct > 0.02); // Fallback: >2% mismatch is anomaly
      const riskScore = aiResponse ? aiResponse.risk_score : (mismatchPct * 3); // Fallback risk score
      const severity = aiResponse ? aiResponse.severity : (mismatchPct > 0.05 ? 'high' : 'medium');
      const action = aiResponse ? aiResponse.recommended_action : 'Quantity mismatch alert. Inspect stock levels.';

      if (isAnomaly) {
        const details = `Quantity Mismatch: Dispatched ${qtyDispatched} units, Received ${qtyReceived} units. Shortage: ${shortage} units (${(mismatchPct*100).toFixed(1)}% loss). Action: ${action}`;
        
        const alertRes = await db.query(
          `INSERT INTO alerts (shipment_id, alert_type, severity, details, risk_score) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [id, 'quantity_mismatch', severity, details, riskScore]
        );

        socketService.emitAlert(alertRes.rows[0]);
      }
    }

    res.json({
      message: 'Delivery confirmed successfully. Quantity receipt recorded.',
      shipment: updatedShipment
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Confirm delivery error:', error);
    res.status(500).json({ message: 'Server error confirming delivery.' });
  }
};
