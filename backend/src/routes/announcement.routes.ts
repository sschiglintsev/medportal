import { Router } from 'express';

import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from '../controllers/announcement.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminForReferences } from '../middlewares/rbac.middleware';

const announcementRouter = Router();

announcementRouter.get('/announcements', getAnnouncements);
announcementRouter.post('/announcements', requireAuth, requireAdminForReferences, createAnnouncement);
announcementRouter.put('/announcements/:id', requireAuth, requireAdminForReferences, updateAnnouncement);
announcementRouter.delete('/announcements/:id', requireAuth, requireAdminForReferences, deleteAnnouncement);

export { announcementRouter };
