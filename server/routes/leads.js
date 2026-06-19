const express = require('express');
const router = express.Router();
const { createLead, getLeads, getLead, updateLead, updateLeadStatus, convertLead, conflictCheck } = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');

// Intake form — publicly accessible (no auth)
router.post('/intake', createLead);

// All other routes require auth
router.use(protect);
router.get('/', getLeads);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.put('/:id/status', updateLeadStatus);
router.post('/:id/convert', authorize('attorney'), convertLead);
router.post('/conflict-check', conflictCheck);

module.exports = router;
