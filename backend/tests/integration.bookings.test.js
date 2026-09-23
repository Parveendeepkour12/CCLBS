/** tests/integration.bookings.test.js — booking lifecycle over HTTP (TC-28 – TC-45). */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, STUDENT, FACULTY, ADMIN, uniqueSlot, futureDate } from './helpers.js';

let ctx;
const made = {}; // ids created during the run, reused across dependent cases

before(async () => { ctx = await startServer(); });
after(async () => { await ctx.close(); });

describe('POST /api/bookings', () => {
  test('TC-28 an unauthenticated request is rejected with 401', async () => {
    assert.equal((await ctx.api('POST', '/api/bookings', { body: uniqueSlot() })).status, 401);
  });

  test('TC-29 a student booking is created in pending state', async () => {
    const res = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r1' }), as: STUDENT });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.roomCode, 'CL-A101');
    assert.equal(res.body.userId, STUDENT);
    made.pending = res.body;
  });

  test('TC-30 a faculty booking is created already confirmed', async () => {
    const res = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r1' }), as: FACULTY });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'confirmed');
    made.faculty = res.body;
  });

  test('TC-31 a clashing request returns 409 and identifies the blocking booking', async () => {
    const clash = { ...uniqueSlot({ roomId: 'r2' }), startHour: made.pending.startHour, endHour: made.pending.endHour + 1, date: made.pending.date, roomId: made.pending.roomId };
    const res = await ctx.api('POST', '/api/bookings', { body: clash, as: FACULTY });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.details[0].rule, 'overlap');
    assert.equal(res.body.error.details[0].clashCode, made.pending.code);
  });

  test('TC-32 a request exceeding the room capacity returns 400', async () => {
    const res = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r8', attendees: 50, duration: 1 }), as: STUDENT });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].rule, 'capacity');
    assert.equal(res.body.error.details[0].capacity, 20);
  });

  test('TC-33 a request outside operating hours returns 400', async () => {
    const slot = { ...uniqueSlot({ roomId: 'r2', duration: 1 }), startHour: 6, endHour: 7 };
    const res = await ctx.api('POST', '/api/bookings', { body: slot, as: STUDENT });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].rule, 'operating-hours');
  });

  test('TC-34 a request with a missing purpose returns 400', async () => {
    const { purpose, ...noPurpose } = uniqueSlot({ roomId: 'r1', duration: 1 });
    const res = await ctx.api('POST', '/api/bookings', { body: noPurpose, as: STUDENT });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].field, 'purpose');
  });

  test('TC-35 a request for a non-existent room returns 404', async () => {
    const res = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'rZZ', duration: 1 }), as: STUDENT });
    assert.equal(res.status, 404);
  });
});

describe('GET /api/bookings', () => {
  test('TC-36 a student only ever sees their own bookings', async () => {
    const created = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r5' }), as: STUDENT });
    assert.equal(created.status, 201);
    const res = await ctx.api('GET', '/api/bookings', { as: STUDENT });
    assert.equal(res.status, 200);
    assert.ok(res.body.count >= 3);
    assert.ok(res.body.data.every((b) => b.userId === STUDENT));
  });

  test('TC-37 an administrator sees every booking and can filter by status', async () => {
    const all = await ctx.api('GET', '/api/bookings', { as: ADMIN });
    assert.ok(all.body.count > 10);
    const pending = await ctx.api('GET', '/api/bookings?status=pending', { as: ADMIN });
    assert.ok(pending.body.count > 0);
    assert.ok(pending.body.data.every((b) => b.status === 'pending'));
  });

  test('TC-38 a student reading somebody else\'s booking receives 404, not 403', async () => {
    const res = await ctx.api('GET', `/api/bookings/${made.faculty.id}`, { as: STUDENT });
    assert.equal(res.status, 404);
  });

  test('TC-39 an unknown booking identifier returns 404', async () => {
    assert.equal((await ctx.api('GET', '/api/bookings/bk_does_not_exist', { as: ADMIN })).status, 404);
  });
});

describe('Approval workflow over HTTP', () => {
  test('TC-40 a student cannot approve and receives 403', async () => {
    const res = await ctx.api('POST', `/api/bookings/${made.pending.id}/approve`, { as: STUDENT });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  test('TC-41 an administrator approves, then a repeat approval returns 409', async () => {
    const ok = await ctx.api('POST', `/api/bookings/${made.pending.id}/approve`, { as: ADMIN });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'confirmed');
    const again = await ctx.api('POST', `/api/bookings/${made.pending.id}/approve`, { as: ADMIN });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.details[0].rule, 'invalid-transition');
  });

  test('TC-42 a rejected booking cannot then be cancelled', async () => {
    const target = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r3', duration: 1 }), as: STUDENT });
    const rejected = await ctx.api('POST', `/api/bookings/${target.body.id}/reject`, { as: ADMIN });
    assert.equal(rejected.body.status, 'rejected');
    const cancel = await ctx.api('POST', `/api/bookings/${target.body.id}/cancel`, { as: STUDENT });
    assert.equal(cancel.status, 409);
  });

  test('TC-43 the owner can cancel their own pending booking', async () => {
    const target = await ctx.api('POST', '/api/bookings', { body: uniqueSlot({ roomId: 'r7', duration: 1 }), as: STUDENT });
    const res = await ctx.api('POST', `/api/bookings/${target.body.id}/cancel`, { as: STUDENT });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
  });
});

describe('PATCH /api/bookings/:id', () => {
  test('TC-44 a reschedule into an occupied slot is refused with 409', async () => {
    // Explicit hours on a dedicated date so that the setup itself cannot breach the 22:00 close.
    const day = futureDate(60); // inside the 90-day booking horizon
    const first = await ctx.api('POST', '/api/bookings', {
      body: { roomId: 'r2', date: day, startHour: 9, endHour: 10, attendees: 10, purpose: 'Reschedule subject' }, as: FACULTY,
    });
    assert.equal(first.status, 201);
    const blocker = await ctx.api('POST', '/api/bookings', {
      body: { roomId: 'r2', date: day, startHour: 12, endHour: 13, attendees: 10, purpose: 'Reschedule blocker' }, as: ADMIN,
    });
    assert.equal(blocker.status, 201);
    const res = await ctx.api('PATCH', `/api/bookings/${first.body.id}`, { body: { startHour: 12, endHour: 13 }, as: FACULTY });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details[0].rule, 'overlap');
  });

  test('TC-45 a valid reschedule is persisted', async () => {
    const slot = uniqueSlot({ roomId: 'r5', duration: 1 });
    const target = await ctx.api('POST', '/api/bookings', { body: slot, as: FACULTY });
    const res = await ctx.api('PATCH', `/api/bookings/${target.body.id}`, { body: { startHour: slot.startHour + 1, endHour: slot.startHour + 3, attendees: 12 }, as: FACULTY });
    assert.equal(res.status, 200);
    assert.equal(res.body.startHour, slot.startHour + 1);
    assert.equal(res.body.attendees, 12);
  });
});
