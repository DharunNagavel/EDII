const db = require('../models/db');

exports.getStats = async (req, res) => {
  try {
    // 1. Total Warehouses
    const warehouseRes = await db.query('SELECT COUNT(*) FROM warehouses');
    const totalWarehouses = parseInt(warehouseRes.rows[0].count);

    // 2. Active Deliveries (pending, in_transit, delayed)
    const activeRes = await db.query(
      "SELECT COUNT(*) FROM shipments WHERE status IN ('pending', 'in_transit', 'delayed')"
    );
    const activeDeliveries = parseInt(activeRes.rows[0].count);

    // 3. Delayed Deliveries
    const delayedRes = await db.query(
      "SELECT COUNT(*) FROM shipments WHERE status = 'delayed'"
    );
    const delayedDeliveries = parseInt(delayedRes.rows[0].count);

    // 4. Leakage & Deviation Alerts (unresolved alerts count)
    const deviationAlertRes = await db.query(
      "SELECT COUNT(*) FROM alerts WHERE resolved = FALSE AND alert_type IN ('route_deviation', 'long_stop')"
    );
    const leakageAlerts = parseInt(deviationAlertRes.rows[0].count);

    // 5. Quantity Mismatch Alerts (unresolved quantity mismatch alerts count)
    const mismatchAlertRes = await db.query(
      "SELECT COUNT(*) FROM alerts WHERE resolved = FALSE AND alert_type = 'quantity_mismatch'"
    );
    const quantityMismatchAlerts = parseInt(mismatchAlertRes.rows[0].count);

    // 6. Distribution Statistics by Product (for charts)
    const productStatsRes = await db.query(
      `SELECT product_name, 
              SUM(quantity_dispatched) as total_dispatched, 
              SUM(COALESCE(quantity_received, 0)) as total_received,
              SUM(COALESCE(shortage_reported, 0)) as total_shortage
       FROM shipments
       GROUP BY product_name`
    );
    const productStats = productStatsRes.rows;

    // 7. Recent active alerts
    const recentAlertsRes = await db.query(
      `SELECT a.*, s.product_name, w.warehouse_name, fps.shop_name
       FROM alerts a
       JOIN shipments s ON a.shipment_id = s.id
       JOIN warehouses w ON s.warehouse_id = w.id
       JOIN fair_price_shops fps ON s.fps_id = fps.id
       WHERE a.resolved = FALSE
       ORDER BY a.created_at DESC
       LIMIT 5`
    );
    const recentAlerts = recentAlertsRes.rows;

    // 8. Shipments by status (for pie chart)
    const statusStatsRes = await db.query(
      'SELECT status, COUNT(*) as count FROM shipments GROUP BY status'
    );
    const statusStats = statusStatsRes.rows;

    // 9. Delivery success rate (delivered / total completed)
    const successRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
         COUNT(*) FILTER (WHERE status IN ('delivered', 'cancelled')) as completed
       FROM shipments`
    );
    const deliveredCount = parseInt(successRes.rows[0].delivered || 0);
    const completedCount = parseInt(successRes.rows[0].completed || 0);
    const successRate = completedCount > 0 ? Math.round((deliveredCount / completedCount) * 100) : 100;

    res.json({
      totalWarehouses,
      activeDeliveries,
      delayedDeliveries,
      leakageAlerts,
      quantityMismatchAlerts,
      productStats,
      recentAlerts,
      statusStats,
      successRate
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error loading dashboard statistics.' });
  }
};
