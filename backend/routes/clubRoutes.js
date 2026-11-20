const express = require('express');
const router = express.Router();

const {
  createClub,
  getClubs,
  getClubById,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  getClubMembers
} = require('../controllers/clubController');

const {
  verifyToken,
  authorizeRole
} = require('../middleware/authMiddleware');

const {
  uploadClubImages
} = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getClubs);
router.get('/:id', getClubById);

// Admin and SuperAdmin routes
router.post(
  '/',
  verifyToken,
  authorizeRole('admin', 'superadmin'),
  uploadClubImages,
  createClub
);

router.delete(
  '/:id',
  verifyToken,
  authorizeRole('admin', 'superadmin'),
  deleteClub
);

// Admin, SuperAdmin and President
router.put(
  '/:id',
  verifyToken,
  uploadClubImages,
  updateClub
);

// Protected members route
router.get(
  '/:id/members',
  verifyToken,
  authorizeRole('admin', 'superadmin', 'president'),
  getClubMembers
);

// Student and President routes
router.post(
  '/:id/join',
  verifyToken,
  authorizeRole('student', 'president'),
  joinClub
);

router.delete(
  '/:id/leave',
  verifyToken,
  authorizeRole('student', 'president'),
  leaveClub
);

module.exports = router;
