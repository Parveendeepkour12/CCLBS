/**
 * app.js — assembles the Express application. Kept separate from server.js so that
 * tests can mount the app on an ephemeral port without touching the real listener.
 */
import express from 'express';
import { ApiError } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { bookingRoutes } from './routes/bookings.js';
import { userRoutes } from './routes/users.js';
import { reportRoutes } from './routes/reports.js';

export function createApp(db, { logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Baseline security headers. Deliberately dependency-free.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });

  app.use(express.json({ limit: '64kb' }));

  // Tiny in-process request logger — enough to evidence API traffic in the report.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.log?.(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
    });
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'cclbs-backend', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes(db));
  app.use('/api/rooms', roomRoutes(db));
  app.use('/api/bookings', bookingRoutes(db));
  app.use('/api/users', userRoutes(db));
  app.use('/api/reports', reportRoutes(db));

  // Self-describing index so a caller (or the lecturer) can discover the contract.
  app.get('/api', (_req, res) =>
    res.json({
      name: 'CCLBS REST API',
      version: '1.0.0',
      endpoints: [
        'POST   /api/auth/login',
        'GET    /api/auth/me',
        'POST   /api/auth/logout',
        'GET    /api/rooms?building=&type=&minCapacity=&equipment=&q=&active=',
        'GET    /api/rooms/:id',
        'GET    /api/rooms/:id/availability?date=YYYY-MM-DD',
        'POST   /api/rooms            (admin)',
        'PATCH  /api/rooms/:id        (admin)',
        'GET    /api/bookings?status=&roomId=&from=&to=&mine=',
        'GET    /api/bookings/:id',
        'POST   /api/bookings',
        'PATCH  /api/bookings/:id',
        'POST   /api/bookings/:id/approve (admin)',
        'POST   /api/bookings/:id/reject  (admin)',
        'POST   /api/bookings/:id/cancel',
        'GET    /api/users',
        'PATCH  /api/users/:id/role   (admin)',
        'PATCH  /api/users/:id/active (admin)',
        'GET    /api/reports/summary            (admin)',
        'GET    /api/reports/utilisation        (admin)',
        'GET    /api/reports/bookings-by-room   (admin)',
      ],
    }),
  );

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'No such endpoint.')));

  // Central error handler: one JSON envelope for every failure path.
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    logger.error?.(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.', details: [] } });
  });

  return app;
}
