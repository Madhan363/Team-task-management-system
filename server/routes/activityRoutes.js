import express from 'express';
import { requireRole, requireUser } from '../middleware/auth.js';
import {
  getActivityReport,
  postActivity,
  postPresence,
  startTrackedSession,
} from '../controllers/activityReportController.js';

const router = express.Router();

router.use(requireUser);
router.post('/session', startTrackedSession);
router.post('/activity', requireRole('admin', 'team_leader', 'team_member', 'personal'), postActivity);
router.post('/presence', requireRole('admin', 'team_leader', 'team_member', 'personal'), postPresence);
router.get('/report', requireRole('admin', 'team_leader', 'team_member', 'personal'), getActivityReport);

export default router;
