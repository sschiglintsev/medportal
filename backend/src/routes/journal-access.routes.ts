import { Router } from 'express';

import {
  getDepartmentAccess,
  getJournalDepartments,
  updateDepartmentAccess,
} from '../controllers/journal-access.controller';
import { requireAuth, requireAnyPermission, requirePasswordChanged } from '../middlewares/auth.middleware';

const journalAccessRouter = Router();

// Список отделений — управленцам и сотрудникам (разный набор)
journalAccessRouter.get(
  '/journal-departments',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageJournalAccess', 'canManageAllJournals', 'canAccessCabinet']),
  getJournalDepartments,
);

// Список допуска по отделению — только управленцам
journalAccessRouter.get(
  '/journal-departments/:departmentId/access',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageJournalAccess', 'canManageAllJournals']),
  getDepartmentAccess,
);

journalAccessRouter.put(
  '/journal-departments/:departmentId/access',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageJournalAccess', 'canManageAllJournals']),
  updateDepartmentAccess,
);

export { journalAccessRouter };
