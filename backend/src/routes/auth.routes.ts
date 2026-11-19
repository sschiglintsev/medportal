import { Router } from 'express';

import { login, me, register, roles, changePassword } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.get('/roles', roles);
authRouter.get('/me', requireAuth, me);

// Смена пароля — доступна при must_change_password=TRUE (не требует requirePasswordChanged)
authRouter.post('/change-password', requireAuth, changePassword);

export { authRouter };
