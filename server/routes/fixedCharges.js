const express = require('express');
const router = express.Router();
const { getFixedCharges, createFixedCharge, updateFixedCharge, deleteFixedCharge } = require('../controllers/fixedChargeController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getFixedCharges);
router.post('/', createFixedCharge);
router.put('/:id', updateFixedCharge);
router.delete('/:id', deleteFixedCharge);

module.exports = router;
