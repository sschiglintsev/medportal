import { Router } from 'express';

import {
  createTransportRequest,
  getTransportRequestByIdPublic,
  getTransportRequests,
  updateTransportRequestComment,
  updateTransportRequestStatus,
  updateTransportRequestVehicle,
} from '../controllers/transport-request.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';

const transportRequestRouter = Router();

transportRequestRouter.post('/transport-requests', createTransportRequest);
transportRequestRouter.get('/transport-requests/:id/public', getTransportRequestByIdPublic);
transportRequestRouter.get(
  '/transport-requests',
  requireAuth,
  requireRoles(['dispatcher', 'administrator', 'chief_doctor']),
  getTransportRequests,
);
transportRequestRouter.patch(
  '/transport-requests/:id/status',
  requireAuth,
  requireRoles(['dispatcher', 'administrator']),
  updateTransportRequestStatus,
);
transportRequestRouter.patch(
  '/transport-requests/:id/comment',
  requireAuth,
  requireRoles(['dispatcher', 'administrator']),
  updateTransportRequestComment,
);
transportRequestRouter.patch(
  '/transport-requests/:id/vehicle',
  requireAuth,
  requireRoles(['dispatcher']),
  updateTransportRequestVehicle,
);

export { transportRequestRouter };
