const express = require('express');
const router = express.Router();
const { getUsers, getUser, updateUser } = require('../controllers/userController');
const { protect, authorize, hideBillingFromStaff } = require('../middleware/auth');

router.use(protect);
router.get('/', hideBillingFromStaff, getUsers);
router.get('/:id', hideBillingFromStaff, getUser);
router.put('/:id', authorize('attorney'), updateUser);

module.exports = router;
