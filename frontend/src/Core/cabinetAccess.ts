import type { RolePermissions } from './types/common';

export function userHasCabinetAccess(permissions: RolePermissions | undefined): boolean {
  if (!permissions) {
    return false;
  }

  return (
    permissions.canAccessCabinet ||
    permissions.canAccessAdminCabinet ||
    permissions.canAccessQualityCabinet ||
    permissions.canAccessCabinetChief ||
    permissions.canManageItRequests
  );
}
