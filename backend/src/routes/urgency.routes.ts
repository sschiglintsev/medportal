import { Router } from 'express';

import { getUrgencyLevels } from '../controllers/urgency.controller';

const urgencyRouter = Router();

// Публичный маршрут — нужен на форме подачи заявки без авторизации
urgencyRouter.get('/urgency-levels', getUrgencyLevels);

export { urgencyRouter };
