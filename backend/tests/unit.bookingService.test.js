/** tests/unit.bookingService.test.js — unit tests for the booking rule engine (TC-09 – TC-20). */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';
import {
  validateSlot, createBooking, transition, buildAvailability,
  makeBookingCode, OPENING_HOUR, CLOSING_HOUR, MAX_ADVANCE_DAYS,
} from '../src/services/bookingService.js';
import { futureDate } from './helpers.js';

const db = createDb({ path: ':memory:' });
const student = { id: 'u3', role: 'student' };
const admin = { id: 'u1', role: 'admin' };
const DAY = futureDate(30); // a clean day with no seeded bookings

describe('Booking rule engine', () => {
  test('TC-09 rejects a slot outside campus operating hours', () => {
    assert.throws(() => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 7, endHour: 9 }), /only permitted between/);
    assert.throws(() => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 21, endHour: 23 }), /only permitted between/);
    assert.equal(OPENING_HOUR, 8);
    assert.equal(CLOSING_HOUR, 22);
  });

  test('TC-10 rejects a reversed or zero-length slot', () => {
    assert.throws(() => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 12, endHour: 12 }), /endHour must be greater/);
    assert.throws(() => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 15, endHour: 14 }), /endHour must be greater/);
  });

  test('TC-11 rejects attendance above the room capacity', () => {
    assert.throws(() => validateSlot(db, { roomId: 'r8', date: DAY, startHour: 9, endHour: 10, attendees: 30 }), /seats 20 people/);
  });

  test('TC-12 rejects a date in the past', () => {
    assert.throws(() => validateSlot(db, { roomId: 'r1', date: '2020-01-01', startHour: 9, endHour: 10 }), /cannot be in the past/);
  });

  test('TC-13 rejects a date beyond the maximum booking window', () => {
    assert.throws(
      () => validateSlot(db, { roomId: 'r1', date: futureDate(MAX_ADVANCE_DAYS + 5), startHour: 9, endHour: 10 }),
      /only be made up to 90 days/,
    );
  });

  test('TC-14 rejects an unknown room', () => {
    assert.throws(() => validateSlot(db, { roomId: 'rZZ', date: DAY, startHour: 9, endHour: 10 }), /does not exist/);
  });

  test('TC-15 accepts an available slot and returns the room record', () => {
    const room = validateSlot(db, { roomId: 'r1', date: DAY, startHour: 9, endHour: 11 });
    assert.equal(room.code, 'CL-A101');
  });

  test('TC-16 detects an overlapping confirmed booking but allows a back-to-back slot', () => {
    createBooking(db, admin, { roomId: 'r1', date: DAY, startHour: 9, endHour: 11, purpose: 'Unit test block', attendees: 10 });
    assert.throws(
      () => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 10, endHour: 12 }),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.details[0].rule, 'overlap');
        return true;
      },
    );
    // 11:00-12:00 starts exactly when the previous booking ends: half-open intervals do not clash.
    assert.doesNotThrow(() => validateSlot(db, { roomId: 'r1', date: DAY, startHour: 11, endHour: 12 }));
  });

  test('TC-17 students receive a pending booking, staff are auto-confirmed', () => {
    const a = createBooking(db, student, { roomId: 'r2', date: DAY, startHour: 9, endHour: 10, purpose: 'Student request' });
    const b = createBooking(db, admin, { roomId: 'r2', date: DAY, startHour: 11, endHour: 12, purpose: 'Staff request' });
    assert.equal(a.status, 'pending');
    assert.equal(b.status, 'confirmed');
    assert.match(a.code, /^BK-[A-Z2-9]{6}$/);
  });

  test('TC-18 approval workflow enforces valid transitions only', () => {
    const created = createBooking(db, student, { roomId: 'r5', date: DAY, startHour: 9, endHour: 10, purpose: 'Transition test' });
    const approved = transition(db, created.id, admin, 'approve');
    assert.equal(approved.status, 'confirmed');
    assert.throws(() => transition(db, created.id, admin, 'approve'), /Cannot approve/);
    assert.throws(() => transition(db, created.id, admin, 'reject'), /Cannot reject/);
    const cancelled = transition(db, created.id, student, 'cancel');
    assert.equal(cancelled.status, 'cancelled');
    assert.throws(() => transition(db, created.id, student, 'cancel'), /Cannot cancel/);
  });

  test('TC-19 a non-administrator cannot approve, and a non-owner cannot cancel', () => {
    const created = createBooking(db, student, { roomId: 'r6', date: DAY, startHour: 9, endHour: 10, purpose: 'Permission test' });
    assert.throws(() => transition(db, created.id, student, 'approve'), /Only an administrator/);
    assert.throws(() => transition(db, created.id, { id: 'u6', role: 'student' }, 'cancel'), /owner or an administrator/);
  });

  test('TC-20 availability grid covers opening to closing hours and hides booked hours', () => {
    const before = buildAvailability(db, 'r7', DAY);
    assert.equal(before.slots.length, CLOSING_HOUR - OPENING_HOUR);
    assert.equal(before.availableHours, before.slots.length);

    createBooking(db, admin, { roomId: 'r7', date: DAY, startHour: 14, endHour: 16, purpose: 'Grid test' });
    const after = buildAvailability(db, 'r7', DAY);
    assert.equal(after.slots.find((s) => s.hour === 14).available, false);
    assert.equal(after.slots.find((s) => s.hour === 15).available, false);
    assert.equal(after.slots.find((s) => s.hour === 16).available, true);
    assert.equal(after.availableHours, before.availableHours - 2);
  });

  test('TC-21 generated booking codes follow the BK-XXXXXX contract', () => {
    const codes = new Set(Array.from({ length: 50 }, makeBookingCode));
    assert.equal(codes.size, 50);
    for (const c of codes) assert.match(c, /^BK-[A-HJ-NP-Z2-9]{6}$/);
  });
});
