import express from 'express';
import { requireRole, requireUser } from '../middleware/auth.js';
import {
  getImportMembers,
  getProject,
  deleteProject,
  getProjectImportDraft,
  listProjects,
  previewProjectImport,
  publishProjectImport,
  cancelProjectImportDraft,
  saveProjectImportAssignments,
  saveProjectImportRows,
} from '../controllers/projectController.js';

const router = express.Router();

router.use(requireUser);
router.get('/', listProjects);
router.get('/import/members', requireRole('team_leader'), getImportMembers);
router.post('/import/preview', requireRole('team_leader'), previewProjectImport);
router.get('/import/:draftId', requireRole('team_leader'), getProjectImportDraft);
router.put('/import/:draftId/rows', requireRole('team_leader'), saveProjectImportRows);
router.put('/import/:draftId/assignments', requireRole('team_leader'), saveProjectImportAssignments);
router.post('/import/:draftId/publish', requireRole('team_leader'), publishProjectImport);
router.delete('/import/:draftId', requireRole('team_leader', 'admin'), cancelProjectImportDraft);
router.delete('/:projectId', requireRole('team_leader', 'admin'), deleteProject);
router.get('/:projectId', getProject);

export default router;
