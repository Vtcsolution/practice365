const express = require('express');
const router = express.Router();
const { getTimeline } = require('../controllers/timelineController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/:matterId', getTimeline);

module.exports = router;
