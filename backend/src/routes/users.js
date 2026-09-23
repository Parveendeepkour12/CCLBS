/** routes/users.js — user directory and administrator role management. */
import { Router } from 'express';
import { asyncHandler, badRequest, notFound, lastAdmin, selfDemotion } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { requireEnum } from '../validation.js';

const ROLES = ['student', 'faculty', 'admin'];

const toUserDTO = (row) => ({
  id: row.id,
  universityId: row.university_id,
  name: row.name,
  email: row.email,
  role: row.role,
  department: row.department,
  active: Boolean(row.active),
});

export function userRoutes(db) {
  const router = Router();
  router.use(authenticate(db));

  /* GET /api/users — directory. A student only ever receives their own record. */
  router.get(
    '/',
    asyncHandler((req, res) => {
      if (req.user.role === 'student' && req.query.mine !== 'true') {
        return res.json({ count: 1, data: [toUserDTO(req.user)] });
      }
      const rows = db.prepare('SELECT * FROM users ORDER BY name').all();
      return res.json({ count: rows.length, data: rows.map(toUserDTO) });
    }),
  );

  /* PATCH /api/users/:id/role — administrator only, with a last-administrator guard. */
  router.patch(
    '/:id/role',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const role = requireEnum(req.body ?? {}, 'role', ROLES);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      if (!target) throw notFound(`User '${req.params.id}' does not exist.`);

      if (target.id === req.user.id && role !== 'admin') {
        // Prevents an administrator locking the institution out of its own admin console.
        const { n } = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1`).get();
        if (n <= 1) throw lastAdmin();
      }
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id);
      res.json(toUserDTO(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)));
    }),
  );

  /* PATCH /api/users/:id/active — administrator only. */
  router.patch(
    '/:id/active',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const active = req.body?.active;
      if (typeof active !== 'boolean') throw badRequest('active must be a boolean.', [{ field: 'active', rule: 'boolean' }]);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
      if (!target) throw notFound(`User '${req.params.id}' does not exist.`);
      if (target.id === req.user.id && !active) throw selfDemotion();
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, target.id);
      res.json(toUserDTO(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)));
    }),
  );

  return router;
}

export { toUserDTO, ROLES };
