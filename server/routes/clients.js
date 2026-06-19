const express = require('express');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getClients);
router.get('/:id', getClient);
router.post('/', authorize('attorney'), createClient);
router.put('/:id', updateClient);
router.delete('/:id', authorize('attorney'), deleteClient);

module.exports = router;
