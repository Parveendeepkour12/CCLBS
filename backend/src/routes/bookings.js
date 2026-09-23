/** routes/bookings.js — booking lifecycle: create, list, reschedule, approve, reject, cancel. */
import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { BOOKING_SELECT, createBooking, toBookingDTO, transition, validateSlot, makeBookingCode } from '../services/bookingService.js';
import { requireString, requireISODate, optionalInt, requireEnum } from '../validation.js';

const STATUSES = ['confirmed', 'pending', 'cancelled', 'rejected'];

export function bookingRoutes(db) {
  const router = Router();
  router.use(authenticate(db));

  /* POST /api/bookings — create a booking request. */
  router.post(
    '/',
    asyncHandler((req, res) => {
      const body = req.body ?? {};
      const payload = {
        roomId: requireString(body, 'roomId', { min: 1, max: 40 }),
        date: requireISODate(body, 'date'),
        startHour: optionalInt(body, 'startHour', { min: 0, max: 23 }),
        endHour: optionalInt(body, 'endHour', { min: 1, max: 24 }),
        attendees: optionalInt(body, 'attendees', { min: 1, max: 500 }) ?? 1,
        purpose: requireString(body, 'purpose', { min: 3, max: 200 }),
      };
      if (payload.startHour === undefined || payload.endHour === undefined) {
        throw badRequest('startHour and endHour are required.', [{ field: 'startHour', rule: 'required' }]);
      }
      const booking = createBooking(db, req.user, payload);
      res.status(201).json(booking);
    }),
  );

  /* GET /api/bookings — scoped list. Students see only their own; staff can query wider. */
  router.get(
    '/',
    asyncHandler((req, res) => {
      const clauses = [];
      const params = [];

      if (req.query.status) {
        if (!STATUSES.includes(String(req.query.status))) throw badRequest('Unknown status filter.');
        clauses.push('b.status = ?');
        params.push(String(req.query.status));
      }
      if (req.query.roomId) {
        clauses.push('b.room_id = ?');
        params.push(String(req.query.roomId));
      }
      if (req.query.from) {
        clauses.push('b.date >= ?');
        params.push(requireISODate(req.query, 'from'));
      }
      if (req.query.to) {
        clauses.push('b.date <= ?');
        params.push(requireISODate(req.query, 'to'));
      }
      if (req.query.mine === 'true') {
        clauses.push('b.user_id = ?');
        params.push(req.user.id);
      } else if (req.user.role === 'student') {
        // Least privilege: a student cannot enumerate other people's bookings.
        clauses.push('b.user_id = ?');
        params.push(req.user.id);
      }

      const rows = db
        .prepare(`${BOOKING_SELECT} ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY b.date, b.start_hour LIMIT 200`)
        .all(...params);
      res.json({ count: rows.length, data: rows.map(toBookingDTO) });
    }),
  );

  /* GET /api/bookings/:id */
  router.get(
    '/:id',
    asyncHandler((req, res) => {
      const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(req.params.id);
      if (!row) throw notFound(`Booking '${req.params.id}' was not found.`);
      if (req.user.role === 'student' && row.user_id !== req.user.id) {
        throw notFound(`Booking '${req.params.id}' was not found.`); // 404 rather than 403: do not confirm existence.
      }
      res.json(toBookingDTO(row));
    }),
  );

  /* PATCH /api/bookings/:id — reschedule (date / hours / attendees / purpose). */
  router.patch(
    '/:id',
    asyncHandler((req, res) => {
      const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
      if (!row) throw notFound(`Booking '${req.params.id}' was not found.`);
      const isOwner = row.user_id === req.user.id;
      if (!isOwner && req.user.role !== 'admin') throw badRequest('Only the owner or an administrator may edit this booking.');
      if (['cancelled', 'rejected'].includes(row.status)) throw badRequest(`A ${row.status} booking cannot be edited.`);

      const body = req.body ?? {};
      const next = {
        date: body.date !== undefined ? requireISODate(body, 'date') : row.date,
        startHour: optionalInt(body, 'startHour', { min: 0, max: 23 }) ?? row.start_hour,
        endHour: optionalInt(body, 'endHour', { min: 1, max: 24 }) ?? row.end_hour,
        attendees: optionalInt(body, 'attendees', { min: 1, max: 500 }) ?? row.attendees,
        purpose: body.purpose !== undefined ? requireString(body, 'purpose', { min: 3, max: 200 }) : row.purpose,
        roomId: row.room_id,
      };
      // Re-run the full rule set, ignoring this booking's own current slot.
      validateSlot(db, { ...next, ignoreBookingId: row.id });

      db.prepare('UPDATE bookings SET date = ?, start_hour = ?, end_hour = ?, attendees = ?, purpose = ? WHERE id = ?').run(
        next.date, next.startHour, next.endHour, next.attendees, next.purpose, row.id,
      );
      res.json(toBookingDTO(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(row.id)));
    }),
  );

  const action = (name) => (req, res, next) => {
    Promise.resolve()
      .then(() => res.json(transition(db, req.params.id, req.user, name)))
      .catch(next);
  };

  router.post('/:id/approve', requireRole('admin'), action('approve'));
  router.post('/:id/reject', requireRole('admin'), action('reject'));
  router.post('/:id/cancel', action('cancel'));

  return router;
}

export { makeBookingCode };
