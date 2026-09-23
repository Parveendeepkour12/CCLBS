/**
 * scripts/capture-evidence.mjs
 * Boots the real API on an ephemeral port and records the genuine HTTP exchanges used
 * as evidence in the report appendices. Writes evidence/*.json — nothing is hand-written.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { issueToken } from '../src/middleware/auth.js';

const OUT = new URL('../evidence/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const log = [];
const db = createDb({ path: ':memory:' });
const app = createApp(db, { logger: { log: (l) => log.push(l), error: (l) => log.push(`ERROR ${l}`) } });
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const token = (u) => issueToken(u);

const exchanges = [];
async function call(label, method, path, { body, as } = {}) {
  const started = Date.now();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(as ? { authorization: `Bearer ${token(as)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json();
  exchanges.push({ label, request: { method, path, body: body ?? null, actor: as ?? 'anonymous' }, response: { status: res.status, ms: Date.now() - started, body: payload } });
  return payload;
}

/* 1. Service discovery and health ------------------------------------------------- */
await call('Service index', 'GET', '/api');
await call('Health probe', 'GET', '/api/health');

/* 2. Authentication --------------------------------------------------------------- */
await call('Login — administrator', 'POST', '/api/auth/login', { body: { universityId: '20210001' } });
await call('Login — unknown ID', 'POST', '/api/auth/login', { body: { universityId: '99999999' } });
await call('Session lookup', 'GET', '/api/auth/me', { as: 'u1' });
await call('Missing token', 'GET', '/api/auth/me');

/* 3. Room catalogue and availability ---------------------------------------------- */
await call('Room catalogue', 'GET', '/api/rooms', { as: 'u3' });
await call('Filter — computer labs', 'GET', '/api/rooms?type=computer-lab', { as: 'u3' });
await call('Filter — capacity ≥ 100', 'GET', '/api/rooms?minCapacity=100', { as: 'u3' });
await call('Availability grid', 'GET', `/api/rooms/r1/availability?date=${day(45)}`, { as: 'u3' });

/* 4. Booking lifecycle ------------------------------------------------------------ */
const studentBooking = await call('Create — student (pending)', 'POST', '/api/bookings', { as: 'u3', body: { roomId: 'r1', date: day(45), startHour: 9, endHour: 11, attendees: 30, purpose: 'Data Structures lab session' } });
await call('Create — faculty (auto-confirmed)', 'POST', '/api/bookings', { as: 'u2', body: { roomId: 'r1', date: day(45), startHour: 13, endHour: 15, attendees: 25, purpose: 'Circuit Design workshop' } });
await call('Overlap rejected', 'POST', '/api/bookings', { as: 'u2', body: { roomId: 'r1', date: day(45), startHour: 10, endHour: 12, attendees: 10, purpose: 'Clashing request' } });
await call('Capacity rejected', 'POST', '/api/bookings', { as: 'u3', body: { roomId: 'r8', date: day(45), startHour: 9, endHour: 10, attendees: 40, purpose: 'Oversized group' } });
await call('Operating hours rejected', 'POST', '/api/bookings', { as: 'u3', body: { roomId: 'r2', date: day(45), startHour: 6, endHour: 8, attendees: 5, purpose: 'Too early' } });
await call('Student cannot approve', 'POST', `/api/bookings/${studentBooking.id}/approve`, { as: 'u3' });
await call('Administrator approves', 'POST', `/api/bookings/${studentBooking.id}/approve`, { as: 'u1' });
await call('Repeat approval rejected', 'POST', `/api/bookings/${studentBooking.id}/approve`, { as: 'u1' });
await call('Own list (student scope)', 'GET', '/api/bookings?mine=true', { as: 'u3' });
await call('Cross-tenant read returns 404', 'GET', `/api/bookings/${studentBooking.id}`, { as: 'u4' });

/* 5. Administration and analytics -------------------------------------------------- */
await call('Create room (admin)', 'POST', '/api/rooms', { as: 'u1', body: { name: 'Robotics Lab', code: 'CL-E501', building: 'Engineering Block', floor: 5, capacity: 24, type: 'computer-lab', equipment: ['24 PCs', 'Robotics Kit'], description: 'Robotics and embedded systems lab.' } });
await call('Duplicate code rejected', 'POST', '/api/rooms', { as: 'u1', body: { name: 'Duplicate', code: 'CL-E501', building: 'Main Building', type: 'seminar', capacity: 10 } });
await call('Deactivate guard', 'PATCH', '/api/rooms/r1', { as: 'u1', body: { active: false } });
await call('Last-admin guard', 'PATCH', '/api/users/u1/role', { as: 'u1', body: { role: 'student' } });
await call('Report summary', 'GET', '/api/reports/summary', { as: 'u1' });
await call('Utilisation report', 'GET', '/api/reports/utilisation', { as: 'u1' });
await call('Bookings by room', 'GET', '/api/reports/bookings-by-room', { as: 'u1' });

const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY type DESC, name").all().map((r) => r.sql);
const counts = {
  users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  rooms: db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n,
  bookings: db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,
};

writeFileSync(new URL('exchanges.json', OUT), JSON.stringify({ capturedAt: new Date().toISOString(), base, exchanges, counts, schema }, null, 2));
writeFileSync(new URL('request-log.txt', OUT), log.join('\n') + '\n');
console.log(`Captured ${exchanges.length} HTTP exchanges. Counts: ${JSON.stringify(counts)}`);
console.log(log.slice(0, 5).join('\n'));
server.close();
db.close();
