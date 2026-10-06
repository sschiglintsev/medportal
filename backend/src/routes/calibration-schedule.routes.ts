import { Router } from 'express';

import {
  clearCalibrationSchedule,
  createCalibrationItem,
  deleteCalibrationItem,
  getCalibrationSchedule,
  importCalibrationSchedule,
  updateCalibrationItem,
} from '../controllers/calibration-schedule.controller';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';

const calibrationScheduleRouter = Router();
const manageRoles = ['metrologist', 'administrator'];

calibrationScheduleRouter.get('/calibration-schedule', getCalibrationSchedule);
calibrationScheduleRouter.post(
  '/calibration-schedule',
  requireAuth,
  requireRoles(manageRoles),
  createCalibrationItem,
);
calibrationScheduleRouter.post(
  '/calibration-schedule/import',
  requireAuth,
  requireRoles(manageRoles),
  importCalibrationSchedule,
);
calibrationScheduleRouter.put(
  '/calibration-schedule/:id',
  requireAuth,
  requireRoles(manageRoles),
  updateCalibrationItem,
);
calibrationScheduleRouter.delete(
  '/calibration-schedule/all',
  requireAuth,
  requireRoles(manageRoles),
  clearCalibrationSchedule,
);
calibrationScheduleRouter.delete(
  '/calibration-schedule/:id',
  requireAuth,
  requireRoles(manageRoles),
  deleteCalibrationItem,
);

export { calibrationScheduleRouter };
