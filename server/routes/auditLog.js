const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('attorney'), getAuditLogs);
// No PUT, DELETE, or PATCH routes — audit log is append-only

module.exports = router;
