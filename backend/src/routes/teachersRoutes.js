const express = require('express');

const {
  createTeacher,
  getAllTeachers,
  updateTeacher,
} = require('../controllers/teachersController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/', requireRole('admin'), getAllTeachers);
router.post('/', requireRole('admin'), createTeacher);
router.put('/:id', requireRole('admin'), updateTeacher);

module.exports = router;
