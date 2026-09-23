/**
 * validation.js
 * Small, dependency-free validation helpers. Each returns either a cleaned value
 * or throws a 400 ApiError carrying per-field details.
 */
import { badRequest } from './errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(clock = new Date()) {
  return clock.toISOString().slice(0, 10);
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // Catches impossible dates such as 2026-02-31, which JS silently rolls over.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function requireString(body, field, { min = 1, max = 255 } = {}) {
  const value = body?.[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${field} is required.`, [{ field, rule: 'required' }]);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw badRequest(`${field} must be between ${min} and ${max} characters.`, [
      { field, rule: 'length', min, max, actual: trimmed.length },
    ]);
  }
  return trimmed;
}

export function optionalInt(body, field, { min, max } = {}) {
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw badRequest(`${field} must be a whole number.`, [{ field, rule: 'integer' }]);
  }
  if (min !== undefined && value < min) {
    throw badRequest(`${field} must be at least ${min}.`, [{ field, rule: 'min', min, actual: value }]);
  }
  if (max !== undefined && value > max) {
    throw badRequest(`${field} must be at most ${max}.`, [{ field, rule: 'max', max, actual: value }]);
  }
  return value;
}

export function requireEnum(body, field, allowed) {
  const value = body?.[field];
  if (!allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`, [
      { field, rule: 'enum', allowed, actual: value ?? null },
    ]);
  }
  return value;
}

export function requireISODate(body, field) {
  const value = body?.[field];
  if (!isValidISODate(value)) {
    throw badRequest(`${field} must be a valid ISO date (YYYY-MM-DD).`, [{ field, rule: 'iso-date', actual: value ?? null }]);
  }
  return value;
}
