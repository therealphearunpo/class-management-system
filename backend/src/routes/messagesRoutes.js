const express = require('express');

const { createMessage, getAllMessages } = require('../controllers/messagesController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllMessages);
router.post('/', requireRole('admin'), createMessage);

module.exports = router;
