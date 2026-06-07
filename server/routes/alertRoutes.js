const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize(['super_admin', 'citizen']), alertController.getAlerts);
router.patch('/:id/resolve', authenticate, authorize(['super_admin']), alertController.resolveAlert);

module.exports = router;
