import { Router } from 'express';

import {
  createMetrologistRequest,
  getMetrologistRequestByIdPublic,
  getMetrologistRequests,
  updateMetrologistRequestComment,
  updateMetrologistRequestStatus,
} from '../controllers/metrologist-request.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';

const metrologistRequestRouter = Router();

metrologistRequestRouter.post('/metrologist-requests', createMetrologistRequest);
metrologistRequestRouter.get('/metrologist-requests/:id/public', getMetrologistRequestByIdPublic);
metrologistRequestRouter.get(
  '/metrologist-requests',
  requireAuth,
  requireRoles(['metrologist', 'administrator']),
  getMetrologistRequests,
);
metrologistRequestRouter.patch(
  '/metrologist-requests/:id/status',
  requireAuth,
  requireRoles(['metrologist', 'administrator']),
  updateMetrologistRequestStatus,
);
metrologistRequestRouter.patch(
  '/metrologist-requests/:id/comment',
  requireAuth,
  requireRoles(['metrologist', 'administrator']),
  updateMetrologistRequestComment,
);

export { metrologistRequestRouter };
