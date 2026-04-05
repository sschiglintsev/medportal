import { Router } from 'express';

import { createItRequest, getItRequests } from '../controllers/it-request.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { ROLES } from '../middlewares/rbac.middleware';

const itRequestRouter = Router();

itRequestRouter.post('/it-requests', createItRequest);
itRequestRouter.get('/it-requests', requireAuth, requireRoles([ROLES.IT, ROLES.ADMIN]), getItRequests);

export { itRequestRouter };
