const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { portalScope } = require('../middleware/portalAuth');
const { getFirmBranding, getPortalProfile, getPortalMatters, getPortalMatter, getPortalDocuments, getPortalInvoices } = require('../controllers/portalController');
const { getThreads, getMessages, sendMessage } = require('../controllers/messageController');
const { createPaymentIntent, confirmPayment, handlePaymentFailure, getStripeConfig } = require('../controllers/paymentController');

router.use(protect);
router.use(portalScope);

router.get('/branding', getFirmBranding);
router.get('/profile', getPortalProfile);
router.get('/matters', getPortalMatters);
router.get('/matters/:id', getPortalMatter);
router.get('/documents', getPortalDocuments);
router.get('/invoices', getPortalInvoices);
router.get('/messages/threads', getThreads);
router.get('/messages/threads/:threadId', getMessages);
router.post('/messages', sendMessage);
router.get('/stripe-config', getStripeConfig);
router.post('/payments/create-intent', createPaymentIntent);
router.post('/payments/confirm', confirmPayment);
router.post('/payments/failed', handlePaymentFailure);

module.exports = router;
