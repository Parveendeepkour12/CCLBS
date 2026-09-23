/**
 * middleware/auth.js
 * Demonstration authentication. The frontend has no password field, so the
 * backend issues a token derived from a university ID and a demonstration PIN.
 * Roles are read from the database on every request (never trusted from the client).
 */
import { unauthorized, forbidden } from '../errors.js';
import { createHash, timingSafeEqual } from 'node:crypto';

const DEMO_PIN = process.env.CCLBS_DEMO_PIN || '1234';

/** Token = base64url(userId) + "." + SHA-256(userId + PIN). Deterministic and cheap. */
function sign(userId) {
  const mac = createHash('sha256').update(`${userId}:${DEMO_PIN}`).digest('hex').slice(0, 32);
  return `${Buffer.from(userId).toString('base64url')}.${mac}`;
}

export const issueToken = (userId) => sign(userId);

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, mac] = token.split('.');
  let userId;
  try {
    userId = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = sign(userId).split('.')[1];
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function authenticate(db) {
  return (req, _res, next) => {
    const header = req.get('authorization') || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = raw ? verify(raw) : null;
    if (!userId) return next(unauthorized());

    const user = db
      .prepare('SELECT id, university_id, name, email, role, department, active FROM users WHERE id = ?')
      .get(userId);
    if (!user || !user.active) return next(unauthorized('Account is not active.'));

    req.user = user;
    next();
  };
}

/** Route guard: requireRole('admin') or requireRole('faculty','admin'). */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden(`This action requires role: ${roles.join(' or ')}.`));
    next();
  };
}

export const constants = { DEMO_PIN };
