import { Router } from 'express';

import {
  createEmployee,
  exportEmployees,
  getEmployee,
  getEmployees,
  getImportBatch,
  importCommit,
  importPreview,
  resetEmployeePassword,
  setEmployeeStatus,
  updateEmployee,
} from '../controllers/employees.controller';
import { requireAuth, requirePasswordChanged, requirePermission } from '../middlewares/auth.middleware';

const employeesRouter = Router();

// Статические маршруты регистрируем ДО /:id
employeesRouter.get(
  '/employees/export',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  exportEmployees,
);

employeesRouter.post(
  '/employees/import/preview',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  importPreview,
);

employeesRouter.post(
  '/employees/import/:batchId/commit',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  importCommit,
);

employeesRouter.get(
  '/employees/import/:batchId',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  getImportBatch,
);

employeesRouter.post(
  '/employees/:id/reset-password',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  resetEmployeePassword,
);

employeesRouter.patch(
  '/employees/:id/status',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  setEmployeeStatus,
);

// CRUD сотрудников
employeesRouter.get(
  '/employees',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  getEmployees,
);

employeesRouter.post(
  '/employees',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  createEmployee,
);

employeesRouter.get(
  '/employees/:id',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  getEmployee,
);

employeesRouter.patch(
  '/employees/:id',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageEmployees'),
  updateEmployee,
);

export { employeesRouter };
