import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  signup,
  login,
  logout,
  me,
  updateProfile,
  getAdminStatus,
} from '../controllers/authController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.get('/admin-status', getAdminStatus);
router.post('/signup', authRateLimit, signup);
router.post('/register', authRateLimit, requireUser, requireAdmin, signup);
router.post('/login', authRateLimit, login);
router.post('/logout', logout);
router.get('/me', requireUser, me);
router.get('/session', async (request, response, next) => {
  // Graceful session check: if token invalid/absent, returns { user: null }
  try {
    await requireUser(request, response, () => me(request, response, next));
  } catch {
    response.json({ user: null });
  }
});
router.patch('/profile', requireUser, updateProfile);

export default router;
