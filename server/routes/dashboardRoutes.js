import express from 'express';
import {
  getAdminDashboard,
  getTeamLeaderDashboard,
  getAvailableTeamMembers,
  addExistingTeamMember,
  getTeamMemberDashboard,
} from '../controllers/dashboardController.js';
import { requireUser, requireAdmin, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);

router.get('/admin', requireAdmin, getAdminDashboard);
router.get('/team-leader', requireRole('team_leader', 'admin'), getTeamLeaderDashboard);
router.get('/team-leader/available-members', requireRole('team_leader'), getAvailableTeamMembers);
router.post('/team-leader/members/:memberId', requireRole('team_leader'), addExistingTeamMember);
router.get('/team-member', getTeamMemberDashboard);

export default router;
