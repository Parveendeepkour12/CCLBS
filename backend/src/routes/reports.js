/** routes/reports.js — aggregated usage analytics for the admin dashboard and reports page. */
import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export function reportRoutes(db) {
  const router = Router();
  router.use(authenticate(db), requireRole('admin'));

  /* GET /api/reports/summary — headline KPIs. */
  router.get(
    '/summary',
    asyncHandler((_req, res) => {
      const totals = db
        .prepare(
          `SELECT
             COUNT(*)                                                  AS totalBookings,
             SUM(status = 'confirmed')                                 AS confirmed,
             SUM(status = 'pending')                                   AS pending,
             SUM(status = 'cancelled')                                 AS cancelled,
             SUM(status = 'rejected')                                  AS rejected,
             ROUND(SUM(status = 'cancelled') * 100.0 / COUNT(*), 1)    AS cancellationRatePct
           FROM bookings`,
        )
        .get();
      const rooms = db.prepare('SELECT COUNT(*) AS total, SUM(active) AS active FROM rooms').get();
      const users = db.prepare('SELECT COUNT(*) AS total, SUM(role = \'student\') AS students FROM users').get();

      // Busiest hours are a direct input to estates planning (when labs need staffing).
      const peakHours = db
        .prepare(
          `SELECT start_hour AS hour, COUNT(*) AS bookings FROM bookings
            WHERE status IN ('confirmed','pending') GROUP BY start_hour ORDER BY bookings DESC, hour LIMIT 3`,
        )
        .all();

      res.json({
        bookings: totals,
        rooms: { total: rooms.total, active: rooms.active },
        users: { total: users.total, students: users.students },
        peakHours,
      });
    }),
  );

  /* GET /api/reports/utilisation — booked vs. capacity hours per room. */
  router.get(
    '/utilisation',
    asyncHandler((_req, res) => {
      const rows = db
        .prepare(
          `SELECT r.id, r.code, r.name, r.building, r.capacity,
                  COALESCE(SUM(CASE WHEN b.status IN ('confirmed','pending') THEN b.end_hour - b.start_hour END), 0) AS bookedHours,
                  COUNT(b.id) AS bookingCount
             FROM rooms r
             LEFT JOIN bookings b ON b.room_id = r.id
            GROUP BY r.id
            ORDER BY bookedHours DESC, r.code`,
        )
        .all();
      res.json(
        rows.map((r) => ({
          roomId: r.id,
          roomCode: r.code,
          roomName: r.name,
          building: r.building,
          capacity: r.capacity,
          bookedHours: r.bookedHours,
          bookingCount: r.bookingCount,
        })),
      );
    }),
  );

  /* GET /api/reports/bookings-by-room — stable shape for the frontend's existing report chart. */
  router.get(
    '/bookings-by-room',
    asyncHandler((_req, res) => {
      const rows = db
        .prepare(
          `SELECT r.name AS roomName, r.code AS roomCode,
                  COUNT(b.id) AS total,
                  SUM(b.status = 'confirmed') AS confirmed,
                  SUM(b.status = 'pending')   AS pending,
                  SUM(b.status = 'rejected')  AS rejected,
                  SUM(b.status = 'cancelled') AS cancelled
             FROM rooms r LEFT JOIN bookings b ON b.room_id = r.id
            GROUP BY r.id ORDER BY total DESC, r.code`,
        )
        .all();
      res.json(rows);
    }),
  );

  return router;
}
