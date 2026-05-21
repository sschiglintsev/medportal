import { Router } from 'express';

import {
  getMaxLinkStatus,
  startMaxLink,
  toggleMaxNotifications,
  unlinkMax,
  verifyMaxLink,
} from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const maxRouter = Router();

maxRouter.get('/users/me/max-link', requireAuth, getMaxLinkStatus);
maxRouter.post('/users/me/max-link/start', requireAuth, startMaxLink);
maxRouter.post('/users/me/max-link/verify', requireAuth, verifyMaxLink);
maxRouter.delete('/users/me/max-link', requireAuth, unlinkMax);
maxRouter.patch('/users/me/max-link/notifications', requireAuth, toggleMaxNotifications);

export { maxRouter };
