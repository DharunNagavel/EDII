const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/:type', authenticate, authorize(['super_admin']), reportController.generateReport);

module.exports = router;
