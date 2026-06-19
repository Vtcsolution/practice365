const express = require('express');
const router = express.Router();
const { getThreads, getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/threads', getThreads);
router.get('/threads/:threadId', getMessages);
router.post('/', sendMessage);

module.exports = router;
