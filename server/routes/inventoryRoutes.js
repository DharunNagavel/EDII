const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/warehouse/:warehouse_id', authenticate, inventoryController.getInventoryByWarehouse);
router.get('/history/:warehouse_id?', authenticate, inventoryController.getInventoryHistory);
router.post('/update', authenticate, authorize(['super_admin', 'warehouse_manager']), inventoryController.updateStock);

module.exports = router;
