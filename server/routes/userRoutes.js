import express from 'express';
import {
  listUsers,
  createUser,
  getUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
} from '../controllers/userController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);

router.get('/', requireAdmin, listUsers);
router.post('/', requireAdmin, createUser);
router.get('/:id', requireAdmin, getUser);
router.patch('/:id', requireAdmin, updateUser);
router.patch('/:id/status', requireAdmin, toggleUserStatus);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
