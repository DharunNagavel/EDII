const db = require('../models/db');

exports.getInventoryByWarehouse = async (req, res) => {
  const { warehouse_id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM inventory WHERE warehouse_id = $1 ORDER BY product_name ASC',
      [warehouse_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Server error retrieving inventory.' });
  }
};

exports.updateStock = async (req, res) => {
  const { warehouse_id, product_name, quantity, change_type } = req.body; // change_type: 'add' or 'update'

  if (!warehouse_id || !product_name || quantity === undefined || !change_type) {
    return res.status(400).json({ message: 'warehouse_id, product_name, quantity, and change_type are required.' });
  }

  const numericQty = parseFloat(quantity);
  if (isNaN(numericQty) || numericQty < 0) {
    return res.status(400).json({ message: 'Quantity must be a non-negative number.' });
  }

  try {
    // Start transaction
    await db.query('BEGIN');

    // Get current inventory
    const currentRes = await db.query(
      'SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_name = $2',
      [warehouse_id, product_name]
    );

    let currentQty = 0;
    let newQty = 0;

    if (currentRes.rows.length > 0) {
      currentQty = parseFloat(currentRes.rows[0].quantity);
      if (change_type === 'add') {
        newQty = currentQty + numericQty;
      } else {
        newQty = numericQty; // Set absolute
      }

      await db.query(
        'UPDATE inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE warehouse_id = $2 AND product_name = $3',
        [newQty, warehouse_id, product_name]
      );
    } else {
      newQty = numericQty;
      await db.query(
        'INSERT INTO inventory (warehouse_id, product_name, quantity) VALUES ($1, $2, $3)',
        [warehouse_id, product_name, newQty]
      );
    }

    // Insert history
    const qtyChanged = change_type === 'add' ? numericQty : (newQty - currentQty);
    await db.query(
      'INSERT INTO inventory_history (warehouse_id, product_name, change_type, quantity_changed, remaining_quantity) VALUES ($1, $2, $3, $4, $5)',
      [warehouse_id, product_name, change_type, qtyChanged, newQty]
    );

    await db.query('COMMIT');

    res.json({
      message: 'Stock updated successfully.',
      inventory: { warehouse_id, product_name, quantity: newQty }
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Update stock error:', error);
    res.status(500).json({ message: 'Server error updating stock.' });
  }
};

exports.getInventoryHistory = async (req, res) => {
  const { warehouse_id } = req.params;
  try {
    let result;
    if (warehouse_id) {
      result = await db.query(
        `SELECT h.*, w.warehouse_name 
         FROM inventory_history h 
         JOIN warehouses w ON h.warehouse_id = w.id 
         WHERE h.warehouse_id = $1 
         ORDER BY h.created_at DESC`,
        [warehouse_id]
      );
    } else {
      result = await db.query(
        `SELECT h.*, w.warehouse_name 
         FROM inventory_history h 
         JOIN warehouses w ON h.warehouse_id = w.id 
         ORDER BY h.created_at DESC`
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ message: 'Server error retrieving stock history.' });
  }
};
