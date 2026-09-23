/** tests/integration.rooms-reports.test.js — room catalogue, admin CRUD and analytics (TC-46 – TC-60). */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, STUDENT, ADMIN, uniqueSlot, futureDate } from './helpers.js';

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.close(); });

describe('GET /api/rooms', () => {
  test('TC-46 the catalogue returns all eight seeded rooms with parsed equipment', async () => {
    const res = await ctx.api('GET', '/api/rooms', { as: STUDENT });
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 8);
    assert.ok(Array.isArray(res.body.data[0].equipment));
    assert.equal(typeof res.body.data[0].active, 'boolean');
  });

  test('TC-47 filters narrow by type, building, capacity, equipment and keyword', async () => {
    assert.equal((await ctx.api('GET', '/api/rooms?type=computer-lab', { as: STUDENT })).body.count, 4);
    assert.equal((await ctx.api('GET', '/api/rooms?building=Main%20Building', { as: STUDENT })).body.count, 3);
    assert.equal((await ctx.api('GET', '/api/rooms?minCapacity=100', { as: STUDENT })).body.count, 1);
    assert.equal((await ctx.api('GET', '/api/rooms?equipment=3D', { as: STUDENT })).body.count, 1);
    assert.equal((await ctx.api('GET', '/api/rooms?q=Lab', { as: STUDENT })).body.count, 4);
    assert.equal((await ctx.api('GET', '/api/rooms?type=lecture-hall&minCapacity=150', { as: STUDENT })).body.count, 1);
  });

  test('TC-48 an unknown room identifier returns 404', async () => {
    assert.equal((await ctx.api('GET', '/api/rooms/r99', { as: STUDENT })).status, 404);
  });

  test('TC-49 the availability grid returns one entry per opening hour', async () => {
    const day = futureDate(70);
    const res = await ctx.api('GET', `/api/rooms/r3/availability?date=${day}`, { as: STUDENT });
    assert.equal(res.status, 200);
    assert.equal(res.body.slots.length, 14);
    assert.equal(res.body.availableHours, 14);
    assert.equal(res.body.slots[0].label, '08:00-09:00');
  });

  test('TC-50 availability without a date parameter returns 400', async () => {
    assert.equal((await ctx.api('GET', '/api/rooms/r3/availability', { as: STUDENT })).status, 400);
  });
});

describe('Administrator room management', () => {
  test('TC-51 a student cannot create a room', async () => {
    const res = await ctx.api('POST', '/api/rooms', { body: { name: 'X', code: 'XX1', building: 'Y', type: 'classroom', capacity: 10 }, as: STUDENT });
    assert.equal(res.status, 403);
  });

  test('TC-52 an administrator creates a room and a duplicate code is refused', async () => {
    const created = await ctx.api('POST', '/api/rooms', {
      body: { name: 'Robotics Lab', code: 'CL-E501', building: 'Engineering Block', floor: 5, capacity: 24, type: 'computer-lab', equipment: ['24 PCs', 'Robotics Kit'], description: 'New lab' },
      as: ADMIN,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.code, 'CL-E501');
    assert.deepEqual(created.body.equipment, ['24 PCs', 'Robotics Kit']);

    const dup = await ctx.api('POST', '/api/rooms', { body: { name: 'Other', code: 'CL-E501', building: 'Main Building', type: 'seminar', capacity: 10 }, as: ADMIN });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.details[0].rule, 'unique');
  });

  test('TC-53 an administrator updates a room field', async () => {
    const res = await ctx.api('PATCH', '/api/rooms/r4', { body: { capacity: 30 }, as: ADMIN });
    assert.equal(res.status, 200);
    assert.equal(res.body.capacity, 30);
  });

  test('TC-54 deactivating a room with live bookings is refused', async () => {
    // r1 holds seeded confirmed bookings for today, which the guard treats as live.
    const res = await ctx.api('PATCH', '/api/rooms/r1', { body: { active: false }, as: ADMIN });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details[0].rule, 'has-live-bookings');
    assert.ok(res.body.error.details[0].count >= 1);
  });

  test('TC-55 a room with no live bookings can be deactivated and hidden from the catalogue', async () => {
    const ok = await ctx.api('PATCH', '/api/rooms/r8', { body: { active: false }, as: ADMIN });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.active, false);
    const visible = await ctx.api('GET', '/api/rooms', { as: STUDENT });
    assert.equal(visible.body.count, 8); // 9 rooms exist, one is inactive
    const all = await ctx.api('GET', '/api/rooms?active=all', { as: ADMIN });
    assert.equal(all.body.count, 9);
    await ctx.api('PATCH', '/api/rooms/r8', { body: { active: true }, as: ADMIN });
  });
});

describe('Analytics', () => {
  test('TC-56 the summary is consistent with the booking list it aggregates', async () => {
    const summary = await ctx.api('GET', '/api/reports/summary', { as: ADMIN });
    const list = await ctx.api('GET', '/api/bookings', { as: ADMIN });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.bookings.totalBookings, list.body.count);
    assert.equal(
      summary.body.bookings.confirmed + summary.body.bookings.pending + summary.body.bookings.cancelled + summary.body.bookings.rejected,
      summary.body.bookings.totalBookings,
    );
    assert.equal(summary.body.users.total, 7);
    assert.equal(summary.body.rooms.total, 9);
    assert.equal(summary.body.peakHours.length, 3);
    assert.ok(summary.body.bookings.cancellationRatePct >= 0);
  });

  test('TC-57 utilisation returns one row per room with integer booked hours', async () => {
    const res = await ctx.api('GET', '/api/reports/utilisation', { as: ADMIN });
    assert.equal(res.body.length, 9);
    assert.ok(res.body.some((r) => r.bookedHours > 0));
    assert.ok(res.body.every((r) => Number.isInteger(r.bookedHours) && Number.isInteger(r.bookingCount)));
  });

  test('TC-58 bookings-by-room returns every room, including rooms with no bookings', async () => {
    const res = await ctx.api('GET', '/api/reports/bookings-by-room', { as: ADMIN });
    assert.equal(res.body.length, 9);
    assert.ok(res.body.every((r) => typeof r.roomName === 'string' && typeof r.roomCode === 'string'));
    assert.ok(res.body.some((r) => (r.total ?? 0) === 0));
  });

  test('TC-59 a student cannot read analytics', async () => {
    assert.equal((await ctx.api('GET', '/api/reports/summary', { as: STUDENT })).status, 403);
    assert.equal((await ctx.api('GET', '/api/reports/utilisation', { as: STUDENT })).status, 403);
  });
});

describe('User administration', () => {
  test('TC-60 an administrator changes a role, and an invalid role is refused', async () => {
    const ok = await ctx.api('PATCH', '/api/users/u6/role', { body: { role: 'faculty' }, as: ADMIN });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.role, 'faculty');
    assert.equal((await ctx.api('PATCH', '/api/users/u6/role', { body: { role: 'wizard' }, as: ADMIN })).status, 400);
  });

  test('TC-61 the last administrator cannot remove their own admin role', async () => {
    const res = await ctx.api('PATCH', '/api/users/u1/role', { body: { role: 'student' }, as: ADMIN });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details[0].rule, 'last-admin');
  });

  test('TC-62 an administrator cannot deactivate their own account', async () => {
    const res = await ctx.api('PATCH', '/api/users/u1/active', { body: { active: false }, as: ADMIN });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details[0].rule, 'self');
  });
});

describe('End-to-end booking journey', () => {
  test('TC-63 availability → request → approval → list reflects the full happy path', async () => {
    const slot = uniqueSlot({ roomId: 'r6', duration: 2 });
    const before = await ctx.api('GET', `/api/rooms/r6/availability?date=${slot.date}`, { as: STUDENT });
    const freeBefore = before.body.availableHours;

    const request = await ctx.api('POST', '/api/bookings', { body: slot, as: STUDENT });
    assert.equal(request.status, 201);
    assert.equal(request.body.status, 'pending');

    const blocked = await ctx.api('GET', `/api/rooms/r6/availability?date=${slot.date}`, { as: STUDENT });
    assert.equal(blocked.body.availableHours, freeBefore - 2); // pending also reserves the slot
    assert.equal(blocked.body.slots.find((s) => s.hour === slot.startHour).status, 'pending');

    const approved = await ctx.api('POST', `/api/bookings/${request.body.id}/approve`, { as: ADMIN });
    assert.equal(approved.body.status, 'confirmed');

    const mine = await ctx.api('GET', '/api/bookings?mine=true', { as: STUDENT });
    assert.ok(mine.body.data.some((b) => b.id === request.body.id && b.status === 'confirmed'));
  });
});
