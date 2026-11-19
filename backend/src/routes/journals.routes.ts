import { Router } from 'express';

import {
  addRow,
  archiveJournal,
  confirmRow,
  copyRow,
  correctRow,
  createJournal,
  deleteRow,
  getJournal,
  getJournals,
  getRowHistory,
  getRows,
  publishJournal,
  restoreJournal,
  updateColumns,
  updateJournal,
  updateRow,
} from '../controllers/journals.controller';
import {
  requireAuth,
  requireAnyPermission,
  requirePasswordChanged,
} from '../middlewares/auth.middleware';

const journalsRouter = Router();

// Статические маршруты — до /:id
journalsRouter.get(
  '/journals',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission([
    'canManageOwnJournals',
    'canManageAllJournals',
    'canAccessCabinet',
  ]),
  getJournals,
);

journalsRouter.post(
  '/journals',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  createJournal,
);

// Маршруты журнала
journalsRouter.get(
  '/journals/:id',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals', 'canAccessCabinet']),
  getJournal,
);

journalsRouter.patch(
  '/journals/:id',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  updateJournal,
);

journalsRouter.put(
  '/journals/:id/columns',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  updateColumns,
);

journalsRouter.post(
  '/journals/:id/publish',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  publishJournal,
);

journalsRouter.post(
  '/journals/:id/archive',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  archiveJournal,
);

journalsRouter.post(
  '/journals/:id/restore',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  restoreJournal,
);

// Строки
journalsRouter.get(
  '/journals/:id/rows',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals', 'canAccessCabinet']),
  getRows,
);

journalsRouter.post(
  '/journals/:id/rows',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  addRow,
);

// Статические вложенные маршруты — до /:rowId
journalsRouter.patch(
  '/journals/:id/rows/:rowId',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  updateRow,
);

journalsRouter.delete(
  '/journals/:id/rows/:rowId',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  deleteRow,
);

journalsRouter.post(
  '/journals/:id/rows/:rowId/copy',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  copyRow,
);

// Подтверждение — доступно сотруднику с canAccessCabinet
journalsRouter.post(
  '/journals/:id/rows/:rowId/confirm',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canAccessCabinet']),
  confirmRow,
);

journalsRouter.post(
  '/journals/:id/rows/:rowId/corrections',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  correctRow,
);

journalsRouter.get(
  '/journals/:id/rows/:rowId/history',
  requireAuth,
  requirePasswordChanged,
  requireAnyPermission(['canManageOwnJournals', 'canManageAllJournals']),
  getRowHistory,
);

export { journalsRouter };
