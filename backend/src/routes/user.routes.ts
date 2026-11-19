import { Router } from 'express';

import { createUser, deleteUser, getUsers, updateUser } from '../controllers/user.controller';
import { requireAuth, requirePasswordChanged, requirePermission } from '../middlewares/auth.middleware';

const userRouter = Router();

userRouter.get('/users', requireAuth, requirePermission('canManageReferences'), getUsers);
userRouter.post('/users', requireAuth, requirePasswordChanged, requirePermission('canManageReferences'), createUser);
userRouter.put('/users/:id', requireAuth, requirePermission('canManageReferences'), updateUser);
userRouter.delete('/users/:id', requireAuth, requirePermission('canManageReferences'), deleteUser);

export { userRouter };
