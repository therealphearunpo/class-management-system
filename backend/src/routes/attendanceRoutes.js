const express = require('express');

const {
  bulkMark,
  exportAttendance,
  getHistory,
  getStats,
  getToday,
  mark,
} = require('../controllers/attendanceController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware, requireRole('admin', 'teacher'));

router.get('/today', getToday);
router.post('/mark', mark);
router.post('/bulk-mark', bulkMark);
router.get('/history', getHistory);
router.get('/stats', getStats);
router.get('/export', exportAttendance);

module.exports = router;
