const express = require('express');
const router = express.Router();
const { getEvents, getEvent, createEvent, updateEvent, completeDeadline, deleteEvent, getOverdueDeadlines } = require('../controllers/calendarController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getEvents);
router.get('/overdue-deadlines', getOverdueDeadlines);
router.get('/:id', getEvent);
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.put('/:id/complete', completeDeadline);
router.delete('/:id', deleteEvent);

module.exports = router;
