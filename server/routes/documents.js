const express = require('express');
const router = express.Router();
const { getDocuments, getDocument, uploadDocument, updateDocument, deleteDocument, serveFile, downloadFile, getFolders } = require('../controllers/documentController');
const { shareDocument, unshareDocument } = require('../controllers/portalController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../config/upload');

router.use(protect);
router.get('/', getDocuments);
router.get('/folders', getFolders);
router.get('/:id', getDocument);
router.get('/:id/preview', serveFile);
router.get('/:id/download', downloadFile);
router.post('/', upload.single('file'), uploadDocument);
router.put('/:id', updateDocument);
router.put('/:id/share', authorize('attorney', 'staff'), shareDocument);
router.put('/:id/unshare', authorize('attorney', 'staff'), unshareDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
