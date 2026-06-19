const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, generateInvoice, updateInvoice, finalizeInvoice, addAdjustment, getOverdueInvoices, voidInvoice } = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getInvoices);
router.get('/overdue', getOverdueInvoices);
router.get('/:id', getInvoice);
router.post('/generate', authorize('attorney'), generateInvoice);
router.put('/:id', updateInvoice);
router.put('/:id/finalize', authorize('attorney'), finalizeInvoice);
router.post('/:id/adjustment', authorize('attorney'), addAdjustment);
router.put('/:id/void', authorize('attorney'), voidInvoice);

module.exports = router;
