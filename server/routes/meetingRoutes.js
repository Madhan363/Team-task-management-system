import express from 'express';
import { requireRole, requireUser } from '../middleware/auth.js';
import {
  addRoomAnnouncement,
  addMeetingFollowUp,
  addMeetingNote,
  cancelMeeting,
  createMeeting,
  createMeetingRoom,
  deleteMeeting,
  getMeetingOptions,
  listMeetings,
  listMeetingRooms,
  updateMeeting,
  updateMeetingRoom,
  updateMeetingFollowUp,
} from '../controllers/meetingController.js';

const router = express.Router();
router.use(requireUser);

router.get('/options', requireRole('admin', 'team_leader', 'team_member'), getMeetingOptions);
router.get('/rooms', requireRole('admin', 'team_leader', 'team_member'), listMeetingRooms);
router.post('/rooms', requireRole('admin', 'team_leader'), createMeetingRoom);
router.patch('/rooms/:id', requireRole('admin', 'team_leader'), updateMeetingRoom);
router.post('/rooms/:id/announcements', requireRole('admin', 'team_leader'), addRoomAnnouncement);
router.get('/', requireRole('admin', 'team_leader', 'team_member'), listMeetings);
router.post('/', requireRole('admin', 'team_leader'), createMeeting);
router.patch('/:id', requireRole('admin', 'team_leader'), updateMeeting);
router.patch('/:id/cancel', requireRole('admin', 'team_leader'), cancelMeeting);
router.delete('/:id', requireRole('admin', 'team_leader'), deleteMeeting);
router.post('/:id/notes', requireRole('admin', 'team_leader', 'team_member'), addMeetingNote);
router.post('/:id/follow-ups', requireRole('admin', 'team_leader', 'team_member'), addMeetingFollowUp);
router.patch('/:id/follow-ups/:followUpId', requireRole('admin', 'team_leader', 'team_member'), updateMeetingFollowUp);

export default router;
