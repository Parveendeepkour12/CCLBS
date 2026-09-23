/** routes/auth.js — login identity, session lookup and logout. */
import { Router } from 'express';
import { createHash } from 'node:crypto';
import { asyncHandler, badRequest, notFound } from '../errors.js';
import { authenticate, issueToken } from '../middleware/auth.js';

/**
 * University IDs are never queried or logged in clear text. The SHA-256 is computed
 * server-side and compared against the indexed hash column, so the raw identifier does
 * not reach the SQL text or the query log. Seeded rows are migrated once at boot.
 */
export const hashUniversityId = (value) => createHash('sha256').update(String(value).trim()).digest('hex');

export function authRoutes(db) {
  const router = Router();

  router.post(
    '/login',
    asyncHandler((req, res) => {
      const universityId = req.body?.universityId;
      if (typeof universityId !== 'string' || universityId.trim() === '') {
        throw badRequest('universityId is required.', [{ field: 'universityId', rule: 'required' }]);
      }
      const user = db
        .prepare('SELECT id, university_id, name, email, role, department, active FROM users WHERE university_id_hash = ?')
        .get(hashUniversityId(universityId));
      if (!user) throw notFound('No account matches that university ID.');
      if (!user.active) throw badRequest('That account has been deactivated.');

      res.json({
        token: issueToken(user.id),
        user: {
          id: user.id,
          universityId: user.university_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      });
    }),
  );

  router.get(
    '/me',
    authenticate(db),
    asyncHandler((req, res) => {
      const u = req.user;
      res.json({ id: u.id, universityId: u.university_id, name: u.name, email: u.email, role: u.role, department: u.department });
    }),
  );

  // Tokens are stateless, so logout is a client-side discard; the endpoint exists for
  // contract completeness and lets the frontend clear the session uniformly.
  router.post(
    '/logout',
    authenticate(db),
    asyncHandler((_req, res) => res.json({ ok: true, message: 'Session ended. Discard the token client-side.' })),
  );

  return router;
}
