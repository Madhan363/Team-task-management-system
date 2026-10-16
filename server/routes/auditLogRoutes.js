import express from 'express';
import { listAuditLogs } from '../controllers/auditLogController.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser, requireAdmin);
router.get('/', listAuditLogs);

export default router;
