import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  chatWithAssistant,
  clearAssistantConversation,
  createAssistantConversation,
  deleteAssistantConversation,
  getAssistantConversation,
  listAssistantConversations,
} from '../controllers/assistantChatController.js';
import { askTeamMemberAssistant } from '../controllers/teamMemberAssistantController.js';
import { requireRole, requireUser } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);
const assistantApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Assistant request limit reached. Please try again later.' },
});
router.use(assistantApiRateLimit);
const assistantChatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Assistant message limit reached. Please try again later.' },
});

router.get('/conversations', listAssistantConversations);
router.post('/conversations', createAssistantConversation);
router.get('/conversations/:id', getAssistantConversation);
router.delete('/conversations/:id', deleteAssistantConversation);
router.delete('/conversations/:id/messages', clearAssistantConversation);
router.post('/chat', assistantChatRateLimit, chatWithAssistant);
router.post('/team-member', requireRole('team_member'), askTeamMemberAssistant);

export default router;
