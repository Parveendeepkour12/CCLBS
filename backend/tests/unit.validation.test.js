/** tests/unit.validation.test.js — unit tests for the input-validation helpers (TC-01 – TC-08). */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireString, optionalInt, requireEnum, requireISODate, isValidISODate, todayISO } from '../src/validation.js';

describe('Validation helpers', () => {
  test('TC-01 requireString trims and returns a valid value', () => {
    assert.equal(requireString({ purpose: '  Lab session  ' }, 'purpose'), 'Lab session');
  });

  test('TC-02 requireString rejects a missing field with a 400 envelope', () => {
    assert.throws(() => requireString({}, 'purpose'), (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.equal(err.details[0].field, 'purpose');
      return true;
    });
  });

  test('TC-03 requireString rejects a value below the minimum length', () => {
    assert.throws(() => requireString({ purpose: 'ab' }, 'purpose', { min: 3 }), /between 3 and 255/);
  });

  test('TC-04 optionalInt accepts a numeric string and applies bounds', () => {
    assert.equal(optionalInt({ attendees: '25' }, 'attendees', { min: 1, max: 40 }), 25);
    assert.throws(() => optionalInt({ attendees: 41 }, 'attendees', { min: 1, max: 40 }), /at most 40/);
  });

  test('TC-05 optionalInt returns undefined for an absent field and rejects decimals', () => {
    assert.equal(optionalInt({}, 'floor'), undefined);
    assert.throws(() => optionalInt({ floor: 1.5 }, 'floor'), /whole number/);
  });

  test('TC-06 requireEnum accepts a member and rejects a non-member', () => {
    assert.equal(requireEnum({ status: 'pending' }, 'status', ['pending', 'confirmed']), 'pending');
    assert.throws(() => requireEnum({ status: 'maybe' }, 'status', ['pending', 'confirmed']), /must be one of/);
  });

  test('TC-07 requireISODate rejects malformed and impossible dates', () => {
    assert.equal(requireISODate({ date: '2026-09-21' }, 'date'), '2026-09-21');
    assert.throws(() => requireISODate({ date: '21-09-2026' }, 'date'), /valid ISO date/);
    assert.throws(() => requireISODate({ date: '2026-02-31' }, 'date'), /valid ISO date/);
    assert.equal(isValidISODate('2026-02-31'), false);
  });

  test('TC-08 todayISO returns a YYYY-MM-DD string derived from the injected clock', () => {
    assert.equal(todayISO(new Date('2026-09-20T23:30:00Z')), '2026-09-20');
  });
});
