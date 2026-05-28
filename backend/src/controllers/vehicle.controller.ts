import { NextFunction, Request, Response } from 'express';

import { withDbClient } from '../db';

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await withDbClient((client) =>
    client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id            SERIAL PRIMARY KEY,
        make          VARCHAR(100) NOT NULL,
        model         VARCHAR(100) NOT NULL,
        license_plate VARCHAR(20)  NOT NULL,
        driver        VARCHAR(255),
        created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `),
  );
  tableReady = true;
}

export async function getVehicles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const result = await withDbClient((client) =>
      client.query(
        `SELECT id, make, model, license_plate, driver, created_at
         FROM vehicles
         ORDER BY make, model`,
      ),
    );
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const { make, model, license_plate, driver } = req.body as {
      make?: string;
      model?: string;
      license_plate?: string;
      driver?: string;
    };

    const makeTrimmed          = make?.trim();
    const modelTrimmed         = model?.trim();
    const licensePlateTrimmed  = license_plate?.trim();
    const driverTrimmed        = driver?.trim() || null;

    if (!makeTrimmed || !modelTrimmed || !licensePlateTrimmed) {
      res.status(400).json({ message: 'Поля марка, модель и гос. номер обязательны' });
      return;
    }

    const result = await withDbClient((client) =>
      client.query(
        `INSERT INTO vehicles (make, model, license_plate, driver)
         VALUES ($1, $2, $3, $4)
         RETURNING id, make, model, license_plate, driver, created_at`,
        [makeTrimmed, modelTrimmed, licensePlateTrimmed, driverTrimmed],
      ),
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ message: 'Некорректный ID' });
      return;
    }
    const result = await withDbClient((client) =>
      client.query(`DELETE FROM vehicles WHERE id = $1 RETURNING id`, [id]),
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Автомобиль не найден' });
      return;
    }
    res.status(200).json({ deleted: true });
  } catch (error) {
    next(error);
  }
}
