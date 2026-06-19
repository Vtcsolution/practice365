const express = require('express');
const router = express.Router();
const { createPaymentIntent, confirmPayment, handlePaymentFailure, getStripeConfig } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stripe-config', getStripeConfig);
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.post('/failed', handlePaymentFailure);

module.exports = router;
