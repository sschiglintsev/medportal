import { Router } from 'express';

import {
  createDepartment,
  createIncident,
  createIncidentType,
  getAllIncidents,
  getDepartments,
  getIncidentTypes,
} from '../controllers/incident.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  requireAdminForReferences,
  requireQualityControlForIncidents,
} from '../middlewares/rbac.middleware';

const incidentRouter = Router();

incidentRouter.get('/departments', getDepartments);
incidentRouter.post('/departments', requireAuth, requireAdminForReferences, createDepartment);
incidentRouter.get('/incident-types', getIncidentTypes);
incidentRouter.post('/incident-types', requireAuth, requireAdminForReferences, createIncidentType);
incidentRouter.post('/incidents', createIncident);
incidentRouter.get('/incidents', requireAuth, requireQualityControlForIncidents, getAllIncidents);

export { incidentRouter };
