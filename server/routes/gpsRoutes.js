const express = require('express');
const router = express.Router();
const gpsController = require('../controllers/gpsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/update', authenticate, authorize(['super_admin', 'driver']), gpsController.postLocationUpdate);

module.exports = router;
