import { Router } from 'express';

import { login, me, register, roles } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.get('/roles', roles);
authRouter.get('/me', requireAuth, me);

export { authRouter };
