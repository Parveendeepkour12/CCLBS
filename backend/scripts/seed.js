/**
 * scripts/seed.js — resets the on-disk database to a known demonstration state and
 * prints a signed-in token for each demo role so the API can be exercised by hand.
 */
import { createDb } from '../src/db.js';
import { issueToken } from '../src/middleware/auth.js';

const db = createDb({ path: process.env.CCLBS_DB || 'cclbs.db', seed: true });

console.log('Seeded users:');
for (const u of db.prepare('SELECT id, university_id, name, role FROM users ORDER BY university_id').all()) {
  console.log(`  ${u.university_id}  ${u.name.padEnd(16)} ${u.role.padEnd(8)} token=${issueToken(u.id)}`);
}
console.log(`Rooms: ${db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n}`);
console.log(`Bookings: ${db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n}`);
db.close();
