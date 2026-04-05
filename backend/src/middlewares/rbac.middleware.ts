import { requireRoles } from './auth.middleware';

export const ROLES = {
  CHIEF_DOCTOR: 'Главный врач',
  ADMIN: 'Администратор',
  QUALITY_CONTROL: 'Контроль качества',
  IT: 'ИТ отдел',
  FACILITY: 'АХЧ отдел',
  METROLOG: 'Metrolog',
  EMPLOYEE: 'Сотрудник',
} as const;

// Только администратор управляет справочниками.
export const requireAdminForReferences = requireRoles([ROLES.ADMIN]);

// Администратор и контроль качества могут управлять документами.
export const requireAdminOrQualityForDocuments = requireRoles([ROLES.ADMIN, ROLES.QUALITY_CONTROL]);

// Только контроль качества видит все инциденты.
export const requireQualityControlForIncidents = requireRoles([ROLES.QUALITY_CONTROL]);
