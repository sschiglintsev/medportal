import fs from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import multer from 'multer';

import { deleteLogo, deleteHero, getOrganization, uploadHero, uploadLogo } from '../controllers/organization.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const uploadDir = path.join(process.cwd(), 'uploads', 'organization');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, WebP, SVG)'));
    }
  },
});

const organizationRouter = Router();

organizationRouter.get('/organization', getOrganization);
organizationRouter.post('/organization/logo', requireAuth, requirePermission('canManageReferences'), upload.single('logo'), uploadLogo);
organizationRouter.delete('/organization/logo', requireAuth, requirePermission('canManageReferences'), deleteLogo);
organizationRouter.post('/organization/hero', requireAuth, requirePermission('canManageReferences'), upload.single('hero'), uploadHero);
organizationRouter.delete('/organization/hero', requireAuth, requirePermission('canManageReferences'), deleteHero);

export { organizationRouter };
