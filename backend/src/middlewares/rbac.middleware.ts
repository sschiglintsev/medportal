import { requirePermission } from './auth.middleware';

// Только администратор управляет справочниками.
export const requireAdminForReferences = requirePermission('canManageReferences');

// Администратор и контроль качества могут управлять документами.
export const requireAdminOrQualityForDocuments = requirePermission('canManageDocuments');

// Контроль качества и администратор могут просматривать инциденты.
export const requireQualityControlForIncidents = requirePermission('canViewIncidents');
