import path from 'node:path';

import express from 'express';
import cors from 'cors';

import { healthRouter } from './routes/health.routes';
import { incidentRouter } from './routes/incident.routes';
import { authRouter } from './routes/auth.routes';
import { announcementRouter } from './routes/announcement.routes';
import { documentRouter } from './routes/document.routes';
import { itRequestRouter } from './routes/it-request.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const envAllowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : [];

const allowedOrigins = [...defaultAllowedOrigins, ...envAllowedOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS is not allowed for this origin'));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api', (_req, res) => {
  res.status(200).json({ message: 'API is running' });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', incidentRouter);
app.use('/api', announcementRouter);
app.use('/api', documentRouter);
app.use('/api', itRequestRouter);

app.use(errorHandler);

export { app };
