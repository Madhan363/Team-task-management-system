import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from '../controllers/notificationController.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);

router.get('/', getNotifications);
router.delete('/', clearNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;
