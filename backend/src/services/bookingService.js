/**
 * services/bookingService.js
 * The rule engine. Every business rule that the frontend previously only *implied*
 * (operating hours, overlap, capacity, room state, approval workflow) is enforced here
 * so that the rule cannot be bypassed by calling the API directly.
 */
import { badRequest, conflict, notFound, forbidden } from '../errors.js';
import { newId } from '../db.js';

export const OPENING_HOUR = 8;   // campus buildings open at 08:00
export const CLOSING_HOUR = 22;  // and close at 22:00
export const MAX_ADVANCE_DAYS = 90;

/** Shapes a flat SQL row into the camelCase JSON contract the REST API promises. */
export function toBookingDTO(row) {
  return {
    id: row.id,
    code: row.code,
    roomId: row.room_id,
    roomName: row.room_name ?? undefined,
    roomCode: row.room_code ?? undefined,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    date: row.date,
    startHour: row.start_hour,
    endHour: row.end_hour,
    attendees: row.attendees,
    purpose: row.purpose,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const BOOKING_SELECT = `
  SELECT b.*, r.name AS room_name, r.code AS room_code, u.name AS user_name
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.user_id
`;

export function makeBookingCode() {
  // Readable, collision-checked reference such as BK-4F9K2M.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'BK-';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/**
 * Validates a requested slot against all server-side rules.
 * `ignoreBookingId` lets a reschedule ignore the booking being moved.
 */
export function validateSlot(db, { roomId, date, startHour, endHour, attendees = 1, ignoreBookingId = null }, clock = new Date()) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) throw notFound(`Room '${roomId}' does not exist.`);
  if (!room.active) throw conflict(`Room '${room.code}' is not currently bookable.`, [{ field: 'roomId', rule: 'room-inactive' }]);

  if (startHour >= endHour) {
    throw badRequest('endHour must be greater than startHour.', [{ field: 'endHour', rule: 'range' }]);
  }
  if (startHour < OPENING_HOUR || endHour > CLOSING_HOUR) {
    throw badRequest(`Bookings are only permitted between ${OPENING_HOUR}:00 and ${CLOSING_HOUR}:00.`, [
      { field: 'startHour', rule: 'operating-hours', open: OPENING_HOUR, close: CLOSING_HOUR },
    ]);
  }
  if (attendees > room.capacity) {
    throw badRequest(`Room '${room.code}' seats ${room.capacity} people; ${attendees} were requested.`, [
      { field: 'attendees', rule: 'capacity', capacity: room.capacity, requested: attendees },
    ]);
  }

  const today = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()));
  const target = new Date(`${date}T00:00:00Z`);
  if (target < today) throw badRequest('The booking date cannot be in the past.', [{ field: 'date', rule: 'not-past' }]);
  const leadDays = Math.floor((target - today) / 86_400_000);
  if (leadDays > MAX_ADVANCE_DAYS) {
    throw badRequest(`Bookings may only be made up to ${MAX_ADVANCE_DAYS} days in advance.`, [
      { field: 'date', rule: 'max-advance', maxDays: MAX_ADVANCE_DAYS },
    ]);
  }

  // Half-open interval overlap: [start, end). A slot ending at 11:00 does not clash with one starting at 11:00.
  const clash = db
    .prepare(
      `SELECT code, start_hour, end_hour FROM bookings
        WHERE room_id = ? AND date = ? AND status IN ('confirmed','pending')
          AND id IS NOT ? AND start_hour < ? AND end_hour > ?
        ORDER BY start_hour LIMIT 1`,
    )
    .get(roomId, date, ignoreBookingId, endHour, startHour);
  if (clash) {
    throw conflict(
      `Room '${room.code}' is already booked ${String(clash.start_hour).padStart(2, '0')}:00-${String(clash.end_hour).padStart(2, '0')}:00 on ${date} (${clash.code}).`,
      [{ field: 'startHour', rule: 'overlap', clashCode: clash.code }],
    );
  }

  return room;
}

export function createBooking(db, user, payload, clock = new Date()) {
  const room = validateSlot(db, payload, clock);
  const createdAt = clock.toISOString();

  // Role-based approval: students wait for approval, faculty and admins are auto-confirmed.
  const status = user.role === 'student' ? 'pending' : 'confirmed';
  const id = newId('bk');
  const code = makeBookingCode();

  try {
    db.prepare(
      `INSERT INTO bookings (id, code, room_id, user_id, date, start_hour, end_hour, attendees, purpose, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id, code, room.id, user.id, payload.date, payload.startHour, payload.endHour,
      payload.attendees ?? 1, payload.purpose, status, createdAt,
    );
  } catch (err) {
    // The unique index on (room_id, date, start_hour) is the last line of defence against a
    // double submission that slipped past the SELECT-based check. Surface it as a normal 409.
    if (String(err?.message ?? '').includes('UNIQUE')) {
      throw conflict(`Room '${room.code}' was booked for ${payload.date} at ${String(payload.startHour).padStart(2, '0')}:00 by another request.`, [
        { field: 'startHour', rule: 'overlap' },
      ]);
    }
    throw err;
  }

  return toBookingDTO(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id));
}

export function transition(db, bookingId, actor, action) {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId);
  if (!row) throw notFound(`Booking '${bookingId}' was not found.`);

  const isOwner = row.user_id === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAdmin) throw forbidden('Only the booking owner or an administrator may change this booking.');

  const allowed = {
    approve: ['pending'],
    reject: ['pending'],
    cancel: ['pending', 'confirmed'],
  }[action];
  if (!allowed) throw badRequest(`Unknown action '${action}'.`);

  if (action === 'approve' || action === 'reject') {
    if (!isAdmin) throw forbidden('Only an administrator may approve or reject bookings.');
    if (!allowed.includes(row.status)) {
      throw conflict(`Cannot ${action} a booking whose status is '${row.status}'.`, [{ field: 'status', rule: 'invalid-transition', from: row.status }]);
    }
  }
  if (action === 'cancel' && !allowed.includes(row.status)) {
    throw conflict(`Cannot cancel a booking whose status is '${row.status}'.`, [{ field: 'status', rule: 'invalid-transition', from: row.status }]);
  }

  const next = { approve: 'confirmed', reject: 'rejected', cancel: 'cancelled' }[action];
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(next, bookingId);
  return toBookingDTO(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId));
}

/** Deterministic availability grid used by GET /rooms/:id/availability. */
export function buildAvailability(db, roomId, date) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) throw notFound(`Room '${roomId}' does not exist.`);

  const busy = db
    .prepare(`SELECT start_hour, end_hour, code, status FROM bookings WHERE room_id = ? AND date = ? AND status IN ('confirmed','pending')`)
    .all(roomId, date);

  const slots = [];
  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
    const hit = busy.find((b) => b.start_hour <= hour && b.end_hour > hour);
    slots.push({
      hour,
      label: `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`,
      available: !hit,
      bookingCode: hit?.code ?? null,
      status: hit?.status ?? null,
    });
  }
  return {
    roomId,
    roomCode: room.code,
    date,
    openingHour: OPENING_HOUR,
    closingHour: CLOSING_HOUR,
    slots,
    availableHours: slots.filter((s) => s.available).length,
  };
}
