import { Router } from 'express';

import {
  createAhchRequest,
  getAhchRequestByIdPublic,
  getAhchRequests,
  updateAhchRequestComment,
  updateAhchRequestStatus,
} from '../controllers/ahch-request.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';

const ahchRequestRouter = Router();

ahchRequestRouter.post('/ahch-requests', createAhchRequest);
ahchRequestRouter.get('/ahch-requests/:id/public', getAhchRequestByIdPublic);
ahchRequestRouter.get('/ahch-requests', requireAuth, requireRoles(['facility', 'administrator']), getAhchRequests);
ahchRequestRouter.patch(
  '/ahch-requests/:id/status',
  requireAuth,
  requireRoles(['facility', 'administrator']),
  updateAhchRequestStatus,
);
ahchRequestRouter.patch(
  '/ahch-requests/:id/comment',
  requireAuth,
  requireRoles(['facility', 'administrator']),
  updateAhchRequestComment,
);

export { ahchRequestRouter };
