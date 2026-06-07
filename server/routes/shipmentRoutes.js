const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, shipmentController.getShipments);
router.get('/:id', authenticate, shipmentController.getShipmentById);
router.post('/create', authenticate, authorize(['super_admin', 'warehouse_manager']), shipmentController.createShipment);
router.patch('/:id/status', authenticate, shipmentController.updateShipmentStatus);
router.post('/:id/confirm', authenticate, shipmentController.confirmDelivery);

module.exports = router;
