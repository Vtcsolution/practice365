const express = require('express');
const router = express.Router();
const { getNotes, getNote, createNote, editNote } = require('../controllers/noteController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getNotes);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', editNote);

module.exports = router;
