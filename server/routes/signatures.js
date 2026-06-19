const express = require('express');
const router = express.Router();
const { createSignatureRequest, getSigningPage, completeSignature, getSignatureRequests } = require('../controllers/signatureController');
const { protect, authorize } = require('../middleware/auth');

// Public signing endpoints (token-based auth)
router.get('/sign/:token', getSigningPage);
router.post('/sign/:token/complete', completeSignature);

// Firm-side endpoints (JWT auth)
router.use(protect);
router.get('/', getSignatureRequests);
router.post('/', authorize('attorney'), createSignatureRequest);

module.exports = router;
