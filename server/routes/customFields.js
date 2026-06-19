const express = require('express');
const router = express.Router();
const { getCustomFields, createCustomField, updateCustomField, deleteCustomField } = require('../controllers/customFieldController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getCustomFields);
router.post('/', authorize('attorney'), createCustomField);
router.put('/:id', authorize('attorney'), updateCustomField);
router.delete('/:id', authorize('attorney'), deleteCustomField);

module.exports = router;
