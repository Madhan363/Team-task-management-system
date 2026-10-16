import express from 'express';
import {
  listDepartments,
  createDepartment,
  getDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);

router.get('/', requireAdmin, listDepartments);
router.post('/', requireAdmin, createDepartment);
router.get('/:id', requireAdmin, getDepartment);
router.patch('/:id', requireAdmin, updateDepartment);
router.delete('/:id', requireAdmin, deleteDepartment);

export default router;
