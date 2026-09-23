/**
 * server.js — process entry point. Creates the database, mounts the app, listens.
 * Configuration is environment-driven so the same build runs locally or on a host.
 */
import { createDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);
const DB_PATH = process.env.CCLBS_DB || 'cclbs.db';

const db = createDb({ path: DB_PATH });
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`CCLBS API listening on http://localhost:${PORT}/api  (db: ${DB_PATH})`);
});

const shutdown = () => {
  console.log('Shutting down CCLBS API...');
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
