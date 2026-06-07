const db = require('../models/db');

exports.getAlerts = async (req, res) => {
  try {
    const queryText = `
      SELECT a.*, 
             s.product_name, s.quantity_dispatched, s.status as shipment_status,
             w.warehouse_name,
             fps.shop_name,
             v.vehicle_number,
             u.name as driver_name
      FROM alerts a
      JOIN shipments s ON a.shipment_id = s.id
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN fair_price_shops fps ON s.fps_id = fps.id
      JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      ORDER BY a.created_at DESC
    `;
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Server error retrieving alerts.' });
  }
};

exports.resolveAlert = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE alerts SET resolved = TRUE WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found.' });
    }

    res.json({
      message: 'Alert resolved successfully.',
      alert: result.rows[0]
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ message: 'Server error resolving alert.' });
  }
};
