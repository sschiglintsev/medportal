import fs from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import multer from 'multer';

import { createDocument, deleteDocument, getDocuments, updateDocument } from '../controllers/document.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdminOrQualityForDocuments } from '../middlewares/rbac.middleware';

const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({ storage });

const documentRouter = Router();

documentRouter.get('/documents', getDocuments);
documentRouter.post(
  '/documents',
  requireAuth,
  requireAdminOrQualityForDocuments,
  upload.single('file'),
  createDocument,
);
documentRouter.put(
  '/documents/:id',
  requireAuth,
  requireAdminOrQualityForDocuments,
  upload.single('file'),
  updateDocument,
);
documentRouter.delete('/documents/:id', requireAuth, requireAdminOrQualityForDocuments, deleteDocument);

export { documentRouter };
