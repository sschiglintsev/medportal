import { Router } from 'express';

import { createItRequest, getItRequestByIdPublic, getItRequests, updateItRequestComment, updateItRequestStatus } from '../controllers/it-request.controller';
import { requireAnyPermission, requireAuth } from '../middlewares/auth.middleware';

const itRequestRouter = Router();

itRequestRouter.post('/it-requests', createItRequest);
itRequestRouter.get('/it-requests/:id/public', getItRequestByIdPublic);
itRequestRouter.get(
  '/it-requests',
  requireAuth,
  requireAnyPermission(['canViewItRequests', 'canManageItRequests']),
  getItRequests,
);
itRequestRouter.patch(
  '/it-requests/:id/status',
  requireAuth,
  requireAnyPermission(['canViewItRequests', 'canManageItRequests']),
  updateItRequestStatus,
);
itRequestRouter.patch(
  '/it-requests/:id/comment',
  requireAuth,
  requireAnyPermission(['canManageItRequests', 'canAccessAdminCabinet']),
  updateItRequestComment,
);

export { itRequestRouter };
