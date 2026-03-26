const express = require('express');

const {
  createMessage,
  deleteMessage,
  getAllMessages,
  updateMessage,
} = require('../controllers/messagesController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllMessages);
router.post('/', requireRole('admin'), createMessage);
router.put('/:id', requireRole('admin'), updateMessage);
router.delete('/:id', requireRole('admin'), deleteMessage);

module.exports = router;
