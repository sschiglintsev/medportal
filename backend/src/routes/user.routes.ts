import { Router } from 'express';

import { deleteUser, getUsers, updateUser } from '../controllers/user.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const userRouter = Router();

userRouter.get('/users', requireAuth, requirePermission('canManageReferences'), getUsers);
userRouter.put('/users/:id', requireAuth, requirePermission('canManageReferences'), updateUser);
userRouter.delete('/users/:id', requireAuth, requirePermission('canManageReferences'), deleteUser);

export { userRouter };
