import { Router } from 'express';

import { createVehicle, deleteVehicle, getVehicles } from '../controllers/vehicle.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';

const vehicleRouter = Router();

const manageRoles = ['dispatcher', 'administrator'];

vehicleRouter.get('/vehicles', requireAuth, requireRoles(manageRoles), getVehicles);
vehicleRouter.post('/vehicles', requireAuth, requireRoles(manageRoles), createVehicle);
vehicleRouter.delete('/vehicles/:id', requireAuth, requireRoles(manageRoles), deleteVehicle);

export { vehicleRouter };
