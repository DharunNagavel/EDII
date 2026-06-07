const express = require('express');
const router = express.Router();
const fpsController = require('../controllers/fpsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Warehouses
router.get('/warehouses', authenticate, fpsController.getWarehouses);
router.post('/warehouses', authenticate, authorize(['super_admin']), fpsController.addWarehouse);

// Vehicles
router.get('/vehicles', authenticate, fpsController.getVehicles);
router.post('/vehicles', authenticate, authorize(['super_admin']), fpsController.addVehicle);
router.get('/drivers/available', authenticate, authorize(['super_admin']), fpsController.getAvailableDrivers);

// Fair Price Shops
router.get('/shops', authenticate, fpsController.getFairPriceShops);
router.post('/shops', authenticate, authorize(['super_admin']), fpsController.addFairPriceShop);

module.exports = router;
