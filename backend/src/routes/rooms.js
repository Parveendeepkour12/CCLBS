/** routes/rooms.js — searchable room catalogue, availability grid and admin CRUD. */
import { Router } from 'express';
import { asyncHandler, badRequest, conflict, notFound } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildAvailability } from '../services/bookingService.js';
import { requireString, requireEnum, requireISODate, optionalInt } from '../validation.js';

const ROOM_TYPES = ['classroom', 'computer-lab', 'lecture-hall', 'seminar'];

export function toRoomDTO(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    building: row.building,
    floor: row.floor,
    capacity: row.capacity,
    type: row.type,
    equipment: JSON.parse(row.equipment || '[]'),
    description: row.description,
    active: Boolean(row.active),
  };
}

export function roomRoutes(db) {
  const router = Router();
  router.use(authenticate(db));

  /* GET /api/rooms — supports ?building=&type=&minCapacity=&equipment=&q= filters. */
  router.get(
    '/',
    asyncHandler((req, res) => {
      const clauses = [];
      const params = [];
      if (req.query.building) {
        clauses.push('building = ?');
        params.push(String(req.query.building));
      }
      if (req.query.type) {
        if (!ROOM_TYPES.includes(String(req.query.type))) throw badRequest('Unknown room type filter.');
        clauses.push('type = ?');
        params.push(String(req.query.type));
      }
      if (req.query.minCapacity) {
        const min = Number(req.query.minCapacity);
        if (!Number.isFinite(min) || min < 1) throw badRequest('minCapacity must be a positive number.');
        clauses.push('capacity >= ?');
        params.push(min);
      }
      if (req.query.q) {
        clauses.push('(name LIKE ? OR code LIKE ? OR building LIKE ?)');
        const like = `%${String(req.query.q)}%`;
        params.push(like, like, like);
      }
      if (req.query.active !== 'all') {
        clauses.push('active = 1');
      }

      let rows = db.prepare(`SELECT * FROM rooms ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY code`).all(...params);
      if (req.query.equipment) {
        const needle = String(req.query.equipment).toLowerCase();
        rows = rows.filter((r) => JSON.parse(r.equipment || '[]').some((e) => e.toLowerCase().includes(needle)));
      }
      res.json({ count: rows.length, data: rows.map(toRoomDTO) });
    }),
  );

  /* GET /api/rooms/:id */
  router.get(
    '/:id',
    asyncHandler((req, res) => {
      const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
      if (!row) throw notFound(`Room '${req.params.id}' does not exist.`);
      res.json(toRoomDTO(row));
    }),
  );

  /* GET /api/rooms/:id/availability?date=YYYY-MM-DD */
  router.get(
    '/:id/availability',
    asyncHandler((req, res) => {
      const date = req.query.date;
      if (typeof date !== 'string' || date === '') throw badRequest('A date query parameter (YYYY-MM-DD) is required.', [{ field: 'date', rule: 'required' }]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('date must be formatted YYYY-MM-DD.', [{ field: 'date', rule: 'iso-date' }]);
      res.json(buildAvailability(db, req.params.id, date));
    }),
  );

  /* POST /api/rooms — administrator only. */
  router.post(
    '/',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const body = req.body ?? {};
      const name = requireString(body, 'name', { min: 2, max: 80 });
      const code = requireString(body, 'code', { min: 2, max: 12 }).toUpperCase();
      const building = requireString(body, 'building', { min: 2, max: 60 });
      const type = requireEnum(body, 'type', ROOM_TYPES);
      const capacity = optionalInt(body, 'capacity', { min: 1, max: 500 });
      const floor = optionalInt(body, 'floor', { min: 0, max: 20 }) ?? 0;
      if (capacity === undefined) throw badRequest('capacity is required.', [{ field: 'capacity', rule: 'required' }]);

      if (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) {
        throw conflict(`A room with code '${code}' already exists.`, [{ field: 'code', rule: 'unique' }]);
      }
      const equipment = Array.isArray(body.equipment) ? body.equipment.map(String) : [];
      const id = `rm_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      db.prepare(
        `INSERT INTO rooms (id, name, code, building, floor, capacity, type, equipment, description, active) VALUES (?,?,?,?,?,?,?,?,?,1)`,
      ).run(id, name, code, building, floor, capacity, type, JSON.stringify(equipment), String(body.description ?? ''));

      res.status(201).json(toRoomDTO(db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)));
    }),
  );

  /* PATCH /api/rooms/:id — partial update, administrator only. */
  router.patch(
    '/:id',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
      if (!room) throw notFound(`Room '${req.params.id}' does not exist.`);

      const body = req.body ?? {};
      const sets = [];
      const params = [];
      const push = (column, value) => {
        sets.push(`${column} = ?`);
        params.push(value);
      };
      if (body.name !== undefined) push('name', requireString(body, 'name', { min: 2, max: 80 }));
      if (body.building !== undefined) push('building', requireString(body, 'building', { min: 2, max: 60 }));
      if (body.capacity !== undefined) push('capacity', optionalInt(body, 'capacity', { min: 1, max: 500 }));
      if (body.type !== undefined) push('type', requireEnum(body, 'type', ROOM_TYPES));
      if (body.floor !== undefined) push('floor', optionalInt(body, 'floor', { min: 0, max: 20 }));
      if (body.equipment !== undefined) push('equipment', JSON.stringify(Array.isArray(body.equipment) ? body.equipment.map(String) : []));
      if (body.description !== undefined) push('description', String(body.description));
      if (body.active !== undefined) push('active', body.active ? 1 : 0);
      if (sets.length === 0) throw badRequest('No updatable fields were supplied.');

      // Deactivating a room with live bookings is refused so the calendar cannot silently orphan slots.
      if (body.active === false) {
        const live = db
          .prepare(`SELECT COUNT(*) AS n FROM bookings WHERE room_id = ? AND status IN ('confirmed','pending') AND date >= date('now')`)
          .get(req.params.id).n;
        if (live > 0) throw conflict(`Room has ${live} active future booking(s); cancel them before deactivating.`, [{ field: 'active', rule: 'has-live-bookings', count: live }]);
      }

      params.push(req.params.id);
      db.prepare(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      res.json(toRoomDTO(db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id)));
    }),
  );

  return router;
}
