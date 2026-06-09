import { Router } from 'express';

import {
  addIncidentTypeToViewType,
  createDepartment,
  createIncident,
  createIncidentType,
  createIncidentViewType,
  deleteDepartment,
  deleteIncidentType,
  deleteIncidentViewType,
  getAllIncidents,
  getDepartments,
  getIncidentTypes,
  getIncidentViewTypeLinkedTypes,
  getIncidentViewTypes,
  removeIncidentTypeFromViewType,
  syncIncidentTypesForViewType,
  updateDepartment,
  updateIncidentType,
  updateIncidentViewType,
} from '../controllers/incident.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  requireAdminForReferences,
  requireQualityControlForIncidents,
} from '../middlewares/rbac.middleware';

const incidentRouter = Router();

incidentRouter.get('/departments', getDepartments);
incidentRouter.post('/departments', requireAuth, requireAdminForReferences, createDepartment);
incidentRouter.put('/departments/:id', requireAuth, requireAdminForReferences, updateDepartment);
incidentRouter.delete('/departments/:id', requireAuth, requireAdminForReferences, deleteDepartment);

incidentRouter.get('/incident-types', getIncidentTypes);
incidentRouter.post('/incident-types', requireAuth, requireAdminForReferences, createIncidentType);
incidentRouter.put('/incident-types/:id', requireAuth, requireAdminForReferences, updateIncidentType);
incidentRouter.delete('/incident-types/:id', requireAuth, requireAdminForReferences, deleteIncidentType);

incidentRouter.post('/incidents', createIncident);
incidentRouter.get('/incidents', requireAuth, requireQualityControlForIncidents, getAllIncidents);

incidentRouter.get('/incident-view-types', getIncidentViewTypes);
incidentRouter.post('/incident-view-types', requireAuth, requireAdminForReferences, createIncidentViewType);
incidentRouter.put('/incident-view-types/:id', requireAuth, requireAdminForReferences, updateIncidentViewType);
incidentRouter.delete('/incident-view-types/:id', requireAuth, requireAdminForReferences, deleteIncidentViewType);
incidentRouter.get('/incident-view-types/:id/incident-types', requireAuth, requireQualityControlForIncidents, getIncidentViewTypeLinkedTypes);
incidentRouter.post('/incident-view-types/:id/incident-types', requireAuth, requireAdminForReferences, addIncidentTypeToViewType);
incidentRouter.put('/incident-view-types/:id/incident-types', requireAuth, requireAdminForReferences, syncIncidentTypesForViewType);
incidentRouter.delete('/incident-view-types/:id/incident-types/:typeId', requireAuth, requireAdminForReferences, removeIncidentTypeFromViewType);

export { incidentRouter };
