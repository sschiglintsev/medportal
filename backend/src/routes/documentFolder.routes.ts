import { Router } from 'express';

import {
  createFolder,
  deleteFolder,
  getFolders,
  updateFolder,
} from '../controllers/documentFolder.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrQualityForDocuments } from '../middlewares/rbac.middleware';

const documentFolderRouter = Router();

documentFolderRouter.get('/document-folders', getFolders);
documentFolderRouter.post('/document-folders', requireAuth, requireAdminOrQualityForDocuments, createFolder);
documentFolderRouter.put('/document-folders/:id', requireAuth, requireAdminOrQualityForDocuments, updateFolder);
documentFolderRouter.delete('/document-folders/:id', requireAuth, requireAdminOrQualityForDocuments, deleteFolder);

export { documentFolderRouter };
