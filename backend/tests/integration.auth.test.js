/** tests/integration.auth.test.js — authentication and session endpoints (TC-22 – TC-27). */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, ADMIN } from './helpers.js';

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.close(); });

describe('POST /api/auth/login', () => {
  test('TC-22 a valid university ID returns a token and profile', async () => {
    const res = await ctx.api('POST', '/api/auth/login', { body: { universityId: '20210001' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, 'Maya Chen');
    assert.equal(res.body.user.role, 'admin');
    assert.match(res.body.token, /^[A-Za-z0-9_-]+\.[a-f0-9]{32}$/);
  });

  test('TC-23 an unknown university ID returns 404 with a machine-readable code', async () => {
    const res = await ctx.api('POST', '/api/auth/login', { body: { universityId: '99999999' } });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('TC-24 a missing university ID returns 400 and names the offending field', async () => {
    const res = await ctx.api('POST', '/api/auth/login', { body: {} });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].field, 'universityId');
  });
});

describe('Session endpoints', () => {
  test('TC-25 GET /api/auth/me returns the caller identity for a valid token', async () => {
    const res = await ctx.api('GET', '/api/auth/me', { as: ADMIN });
    assert.equal(res.status, 200);
    assert.equal(res.body.universityId, '20210001');
  });

  test('TC-26 protected endpoints reject a missing or tampered token with 401', async () => {
    assert.equal((await ctx.api('GET', '/api/auth/me')).status, 401);
    assert.equal((await ctx.api('GET', '/api/auth/me', { as: 'u1' })).status, 200); // sanity: valid token works
    const tampered = await fetch(`${ctx.base}/api/auth/me`, { headers: { authorization: 'Bearer dTE.deadbeefdeadbeefdeadbeefdeadbeef' } });
    assert.equal(tampered.status, 401);
  });

  test('TC-27 the service index advertises the contract and security headers are present', async () => {
    const index = await ctx.api('GET', '/api');
    assert.equal(index.status, 200);
    assert.ok(index.body.endpoints.length >= 20);
    const health = await ctx.api('GET', '/api/health');
    assert.equal(health.body.status, 'ok');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
  });
});
