const express = require('express');
const router = express.Router();
const { getMatters, getMatter, createMatter, updateMatter, grantAccess, revokeAccess, getMatterStatuses } = require('../controllers/matterController');
const { protect, authorize, hideBillingFromStaff } = require('../middleware/auth');
const { checkMatterAccess } = require('../middleware/matterAccess');

router.use(protect);
router.get('/statuses', getMatterStatuses);
router.get('/', hideBillingFromStaff, getMatters);
router.get('/:id', hideBillingFromStaff, checkMatterAccess, getMatter);
router.post('/', authorize('attorney'), createMatter);
router.put('/:id', checkMatterAccess, updateMatter);
router.post('/:id/grant-access', authorize('attorney'), grantAccess);
router.post('/:id/revoke-access', authorize('attorney'), revokeAccess);

module.exports = router;
