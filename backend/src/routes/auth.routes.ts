import { Router } from 'express';

import { login, me, register } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.get('/me', requireAuth, me);

export { authRouter };
