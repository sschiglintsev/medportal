import fs from 'node:fs';
import path from 'node:path';

import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

type OrganizationRow = {
  id: number;
  logo_url: string | null;
  hero_image_url: string | null;
  updated_at: string;
};

async function ensureOrganizationTable(): Promise<void> {
  await withDbClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS organization_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        logo_url TEXT,
        hero_image_url TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT single_row CHECK (id = 1)
      )
    `),
  );

  await withDbClient((client) =>
    client.query(`INSERT INTO organization_profile (id) VALUES (1) ON CONFLICT DO NOTHING`),
  );
}

export async function getOrganization(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureOrganizationTable();

    const result = await withDbClient((client) =>
      client.query<OrganizationRow>('SELECT id, logo_url, hero_image_url, updated_at FROM organization_profile WHERE id = 1'),
    );

    res.status(200).json(result.rows[0] ?? { id: 1, logo_url: null, hero_image_url: null });
  } catch (error) {
    next(error);
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureOrganizationTable();

    if (!req.file) {
      res.status(400).json({ message: 'Файл не передан' });
      return;
    }

    const current = await withDbClient((client) =>
      client.query<OrganizationRow>('SELECT logo_url FROM organization_profile WHERE id = 1'),
    );

    const oldUrl = current.rows[0]?.logo_url;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), oldUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const logoUrl = `/uploads/organization/${req.file.filename}`;

    const result = await withDbClient((client) =>
      client.query<OrganizationRow>(
        `UPDATE organization_profile SET logo_url = $1, updated_at = NOW() WHERE id = 1 RETURNING *`,
        [logoUrl],
      ),
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function uploadHero(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureOrganizationTable();

    if (!req.file) {
      res.status(400).json({ message: 'Файл не передан' });
      return;
    }

    const current = await withDbClient((client) =>
      client.query<OrganizationRow>('SELECT hero_image_url FROM organization_profile WHERE id = 1'),
    );

    const oldUrl = current.rows[0]?.hero_image_url;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), oldUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const heroUrl = `/uploads/organization/${req.file.filename}`;

    const result = await withDbClient((client) =>
      client.query<OrganizationRow>(
        `UPDATE organization_profile SET hero_image_url = $1, updated_at = NOW() WHERE id = 1 RETURNING *`,
        [heroUrl],
      ),
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteLogo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const current = await withDbClient((client) =>
      client.query<OrganizationRow>('SELECT logo_url FROM organization_profile WHERE id = 1'),
    );

    const oldUrl = current.rows[0]?.logo_url;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), oldUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const result = await withDbClient((client) =>
      client.query<OrganizationRow>(
        `UPDATE organization_profile SET logo_url = NULL, updated_at = NOW() WHERE id = 1 RETURNING *`,
      ),
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteHero(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const current = await withDbClient((client) =>
      client.query<OrganizationRow>('SELECT hero_image_url FROM organization_profile WHERE id = 1'),
    );

    const oldUrl = current.rows[0]?.hero_image_url;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), oldUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const result = await withDbClient((client) =>
      client.query<OrganizationRow>(
        `UPDATE organization_profile SET hero_image_url = NULL, updated_at = NOW() WHERE id = 1 RETURNING *`,
      ),
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}
