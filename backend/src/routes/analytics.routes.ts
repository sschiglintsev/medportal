import { Router } from 'express';

import { getRequestsAnalytics } from '../controllers/analytics.controller';
import { requireAnyPermission, requireAuth } from '../middlewares/auth.middleware';

const analyticsRouter = Router();

analyticsRouter.get(
  '/analytics/requests',
  requireAuth,
  requireAnyPermission(['canAccessAdminCabinet', 'canAccessCabinetChief']),
  getRequestsAnalytics,
);

export { analyticsRouter };
