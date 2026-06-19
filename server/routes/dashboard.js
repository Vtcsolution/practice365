const express = require('express');
const router = express.Router();
const { getStats, getSettings, updateSettings } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getStats);
router.get('/settings', getSettings);
router.put('/settings', authorize('attorney'), updateSettings);

module.exports = router;
