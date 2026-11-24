import { Router } from 'express';

import {
  clearAllColumns,
  clearColumn,
  createOrGetSheet,
  createPatient,
  getModuleAccess,
  getMyAccess,
  getSheet,
  getTempSheetDepartments,
  listSheets,
  searchPatients,
  updateColumn,
  updateModuleAccess,
  updateSheetHeader,
} from '../controllers/temperature-sheet.controller';
import {
  requireAuth,
  requirePasswordChanged,
  requirePermission,
} from '../middlewares/auth.middleware';

const tempSheetRouter = Router();

// ── Вспомогательная middleware: проверка доступа к модулю ──────────────────
// Для head_nurse/admin — через role permission.
// Для сотрудника — динамическая проверка в контроллере.
// Эта middleware пропускает обоих; конкретный endpoint сам ограничивает доступ
// по temp_sheet_user_access для сотрудников.

async function requireTempSheetModule(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
): Promise<void> {
  // Если у пользователя есть роль-уровневое разрешение — сразу пропускаем
  const perms = (req as { user?: { permissions?: Record<string, boolean> } }).user?.permissions;
  if (perms?.canManageTempSheet) {
    next();
    return;
  }
  // Иначе — динамическая проверка в контроллере (сотрудник)
  // Проверяем только, что пользователь авторизован и не должен менять пароль
  next();
}

// ── Endpoints не требующие авторизации отделения ───────────────────────────

tempSheetRouter.get(
  '/temp-sheets/my-access',
  requireAuth,
  requirePasswordChanged,
  getMyAccess,
);

tempSheetRouter.get(
  '/temp-sheets/departments',
  requireAuth,
  requirePasswordChanged,
  getTempSheetDepartments,
);

tempSheetRouter.get(
  '/temp-sheets/patients',
  requireAuth,
  requirePasswordChanged,
  searchPatients,
);

tempSheetRouter.post(
  '/temp-sheets/patients',
  requireAuth,
  requirePasswordChanged,
  createPatient,
);

// ── Управление доступом (главная медсестра / администратор) ────────────────

tempSheetRouter.get(
  '/temp-sheets/module-access',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageTempSheet'),
  getModuleAccess,
);

tempSheetRouter.put(
  '/temp-sheets/module-access',
  requireAuth,
  requirePasswordChanged,
  requirePermission('canManageTempSheet'),
  updateModuleAccess,
);

// ── Список и создание листов ───────────────────────────────────────────────

tempSheetRouter.get(
  '/temp-sheets',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  listSheets,
);

tempSheetRouter.post(
  '/temp-sheets',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  createOrGetSheet,
);

// ── Операции с конкретным листом ───────────────────────────────────────────

tempSheetRouter.get(
  '/temp-sheets/:id',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  getSheet,
);

tempSheetRouter.patch(
  '/temp-sheets/:id/header',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  updateSheetHeader,
);

tempSheetRouter.patch(
  '/temp-sheets/:id/columns/:col',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  updateColumn,
);

tempSheetRouter.delete(
  '/temp-sheets/:id/columns/:col',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  clearColumn,
);

tempSheetRouter.delete(
  '/temp-sheets/:id/columns',
  requireAuth,
  requirePasswordChanged,
  requireTempSheetModule,
  clearAllColumns,
);

export { tempSheetRouter };
