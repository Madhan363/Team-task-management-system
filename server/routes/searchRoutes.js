import express from 'express';
import { searchGlobal } from '../controllers/searchController.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);
router.get('/', searchGlobal);

export default router;
