/**
 * db.js
 * SQLite persistence layer (Node's built-in `node:sqlite`, no native build step).
 * Owns the schema and the seed data derived from the frontend's mockData.ts so the
 * API and the existing UI describe exactly the same rooms and users.
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  university_id TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role                TEXT NOT NULL CHECK (role IN ('student','faculty','admin')),
  department          TEXT NOT NULL,
  university_id_hash  TEXT,
  active              INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  building    TEXT NOT NULL,
  floor       INTEGER NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  type        TEXT NOT NULL CHECK (type IN ('classroom','computer-lab','lecture-hall','seminar')),
  equipment   TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  room_id    TEXT NOT NULL REFERENCES rooms(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour   INTEGER NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
  attendees  INTEGER NOT NULL DEFAULT 1 CHECK (attendees > 0),
  purpose    TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('confirmed','pending','cancelled','rejected')),
  created_at TEXT NOT NULL,
  CHECK (end_hour > start_hour)
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, date);
-- One live booking may occupy a given start hour: the database is the final arbiter if two
-- requests race past the application-level overlap check.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot
  ON bookings(room_id, date, start_hour) WHERE status IN ('confirmed','pending');
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
`;

const SEED_USERS = [
  ['u1', '20210001', 'Maya Chen', 'maya.chen@university.edu', 'admin', 'Computer Science'],
  ['u2', '20210045', 'James Okoro', 'james.okoro@university.edu', 'faculty', 'Electrical Engineering'],
  ['u3', '20210120', 'Sofia Ramirez', 'sofia.ramirez@university.edu', 'student', 'Computer Science'],
  ['u4', '20210088', 'Liam Murphy', 'liam.murphy@university.edu', 'faculty', 'Mathematics'],
  ['u5', '20210233', 'Aisha Khan', 'aisha.khan@university.edu', 'student', 'Information Systems'],
  ['u6', '20210310', 'Noah Tanaka', 'noah.tanaka@university.edu', 'student', 'Electrical Engineering'],
  ['u7', '20209901', 'Elena Petrova', 'elena.petrova@university.edu', 'faculty', 'Information Systems'],
];

const SEED_ROOMS = [
  ['r1', 'Computer Lab A', 'CL-A101', 'Engineering Block', 1, 40, 'computer-lab', ['Projector', 'Whiteboard', '40 PCs', 'Air Conditioning'], 'Modern computer lab with 40 high-performance workstations.'],
  ['r2', 'Computer Lab B', 'CL-B201', 'Engineering Block', 2, 30, 'computer-lab', ['Projector', '30 PCs', 'Printer Access', 'Air Conditioning'], 'Mid-size lab with 30 workstations and direct printer access.'],
  ['r3', 'Lecture Hall 1', 'LH-GF01', 'Main Building', 0, 200, 'lecture-hall', ['Projector', 'Microphone', 'Audio System', 'Wheelchair Access'], 'Large tiered lecture hall with built-in AV system.'],
  ['r4', 'Seminar Room 3', 'SR-C310', 'Science Wing', 3, 25, 'seminar', ['Smart Board', 'Whiteboard', 'Video Conferencing'], 'Intimate seminar room with smart board and video conferencing.'],
  ['r5', 'Computer Lab C', 'CL-C102', 'Science Wing', 1, 35, 'computer-lab', ['Projector', '35 Macs', 'Air Conditioning'], 'Apple ecosystem lab with 35 iMac workstations.'],
  ['r6', 'Classroom 2A', 'CR-A2A0', 'Engineering Block', 2, 60, 'classroom', ['Projector', 'Whiteboard'], 'Standard classroom with projector and whiteboard.'],
  ['r7', 'Computer Lab D', 'CL-D405', 'Main Building', 4, 28, 'computer-lab', ['Projector', '28 PCs', '3D Printer', 'Air Conditioning'], 'Specialised lab with 3D printing facilities.'],
  ['r8', 'Seminar Room 1', 'SR-B110', 'Main Building', 1, 20, 'seminar', ['Whiteboard', 'Video Conferencing'], 'Compact seminar room for group discussions.'],
];

/** Relative dates keep the seed meaningful whenever the database is created. */
function dayOffset(offsetDays, clock = new Date()) {
  const d = new Date(clock);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function seedBookings() {
  const rows = [
    ['b1', 'BK-7X2K9P', 'r1', 'u3', dayOffset(0), 9, 11, 35, 'Data Structures lab session', 'confirmed'],
    ['b2', 'BK-3M8T2Q', 'r1', 'u2', dayOffset(0), 13, 15, 30, 'Circuit Design workshop', 'pending'],
    ['b3', 'BK-5N1W7R', 'r3', 'u4', dayOffset(0), 10, 12, 180, 'Calculus II lecture', 'confirmed'],
    ['b4', 'BK-9P4L6S', 'r5', 'u5', dayOffset(1), 14, 17, 25, 'UI/UX Design project work', 'pending'],
    ['b5', 'BK-2K8J3M', 'r7', 'u6', dayOffset(2), 9, 12, 20, '3D Prototyping lab', 'confirmed'],
    ['b6', 'BK-6T3R9N', 'r2', 'u3', dayOffset(3), 15, 17, 12, 'Algorithms study group', 'confirmed'],
    ['b7', 'BK-4W7Y1F', 'r4', 'u7', dayOffset(-2), 10, 12, 18, 'Research seminar', 'cancelled'],
    ['b8', 'BK-8Q2D5V', 'r1', 'u1', dayOffset(-1), 8, 10, 15, 'Faculty meeting', 'confirmed'],
    ['b9', 'BK-1H6G4C', 'r6', 'u2', dayOffset(-5), 13, 16, 45, 'Signals & Systems lecture', 'confirmed'],
    ['b10', 'BK-7Z3B8X', 'r3', 'u4', dayOffset(4), 10, 12, 150, 'Linear Algebra lecture', 'confirmed'],
  ];
  const createdAt = new Date(Date.now() - 86_400_000 * 3).toISOString();
  return rows.map((r) => [...r, createdAt]);
}

export function createDb({ path = ':memory:', seed = true } = {}) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);

  if (seed) {
    const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (userCount === 0) {
      const insUser = db.prepare('INSERT INTO users (id, university_id, name, email, role, department) VALUES (?,?,?,?,?,?)');
      for (const u of SEED_USERS) insUser.run(...u);

      const insRoom = db.prepare('INSERT INTO rooms (id, name, code, building, floor, capacity, type, equipment, description) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const r of SEED_ROOMS) {
        const [id, name, code, building, floor, capacity, type, equipment, description] = r;
        insRoom.run(id, name, code, building, floor, capacity, type, JSON.stringify(equipment), description);
      }

      const insBooking = db.prepare(
        `INSERT INTO bookings (id, code, room_id, user_id, date, start_hour, end_hour, attendees, purpose, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const b of seedBookings()) insBooking.run(...b);
    }
  }

  // Backfill the university-ID hash for any row created before the column existed.
  const pending = db.prepare('SELECT id, university_id FROM users WHERE university_id_hash IS NULL').all();
  if (pending.length) {
    const set = db.prepare('UPDATE users SET university_id_hash = ? WHERE id = ?');
    for (const row of pending) {
      set.run(createHash('sha256').update(row.university_id).digest('hex'), row.id);
    }
  }

  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export const newId = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`;
