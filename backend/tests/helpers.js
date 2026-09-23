/** tests/helpers.js — shared fixtures: an in-memory database and a live HTTP server per test file. */
import { once } from 'node:events';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { issueToken } from '../src/middleware/auth.js';

export function futureDate(daysAhead = 1) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Allocates a reservation slot that cannot collide with the seed data or with any other
 * test in the same file. Each call advances the calendar day and the start hour, so the
 * suite is order-independent: eight distinct slots per day, starting 20 days out.
 */
let slotCounter = 0;
export function uniqueSlot({ roomId = 'r1', attendees = 20, purpose = 'Integration test booking', duration = 2 } = {}) {
  const n = slotCounter++;
  const startHour = 8 + (n % 6) * 2; // 08,10,12,14,16,18 — always inside 08:00-22:00
  return {
    roomId,
    date: futureDate(20 + Math.floor(n / 6)),
    startHour,
    endHour: startHour + duration,
    attendees,
    purpose,
  };
}

export async function startServer() {
  const db = createDb({ path: ':memory:' });
  // Silent logger: the request log would otherwise drown the test reporter.
  const app = createApp(db, { logger: { log() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const tokenFor = (userId) => issueToken(userId);

  const api = async (method, path, { body, as } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(as ? { authorization: `Bearer ${tokenFor(as)}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };

  return {
    db, server, api, base, tokenFor,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const STUDENT = 'u3'; // Sofia Ramirez
export const FACULTY = 'u2'; // James Okoro
export const ADMIN = 'u1';   // Maya Chen
