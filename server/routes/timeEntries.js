const express = require('express');
const router = express.Router();
const {
  getTimeEntries, createTimeEntry, updateTimeEntry, deleteTimeEntry,
  startTimer, stopTimer, discardTimer, getActiveTimers
} = require('../controllers/timeEntryController');
const { protect, hideBillingFromStaff } = require('../middleware/auth');

router.use(protect);
router.get('/timer/active', getActiveTimers);
router.post('/timer/start', startTimer);
router.post('/timer/stop', stopTimer);
router.post('/timer/discard', discardTimer);
router.get('/', hideBillingFromStaff, getTimeEntries);
router.post('/', createTimeEntry);
router.put('/:id', updateTimeEntry);
router.delete('/:id', deleteTimeEntry);

module.exports = router;
