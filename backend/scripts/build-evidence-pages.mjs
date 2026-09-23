/**
 * scripts/build-evidence-pages.mjs
 * Turns the REAL captured HTTP exchanges (evidence/exchanges.json) into self-contained
 * HTML pages. Screenshots of these pages are the figures used in Appendix B/C — the data
 * shown is a verbatim dump of what the API returned, never hand-typed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../evidence/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const { exchanges, counts, capturedAt, schema } = JSON.parse(readFileSync(new URL('exchanges.json', OUT), 'utf8'));

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const j = (v) => esc(JSON.stringify(v, null, 2));

const shell = (title, subtitle, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 :root{--bg:#f6f7fb;--card:#fff;--ink:#1b1f2a;--muted:#6b7280;--line:#e3e6ee;--accent:#3730a3;--ok:#0f766e;--bad:#b91c1c}
 *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif}
 header{background:var(--accent);color:#fff;padding:22px 32px} header h1{margin:0;font-size:20px} header p{margin:6px 0 0;opacity:.85;font-size:13px}
 main{padding:24px 32px 48px;max-width:1180px}
 .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:14px}
 .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
 .method{font-weight:700;font-size:12px;background:#eef0f8;color:var(--accent);padding:3px 8px;border-radius:6px}
 .path{font-family:ui-monospace,Consolas,monospace;font-size:13px}
 .badge{font-size:12px;font-weight:700;color:#fff;background:var(--ok);padding:3px 9px;border-radius:20px}
 .badge.err{background:var(--bad)} .badge.warn{background:#b45309}
 .label{font-weight:600;font-size:13px;color:var(--muted);margin:10px 0 4px}
 pre{background:#0f172a;color:#d8e2f0;padding:12px 14px;border-radius:8px;overflow-x:auto;font:12px/1.5 ui-monospace,Consolas,monospace;margin:0}
 table{width:100%;border-collapse:collapse;font-size:13px} th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)} th{background:#eef0f8;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
 .kpi{display:flex;gap:14px;flex-wrap:wrap} .kpi div{flex:1;min-width:150px;background:#eef0f8;border-radius:8px;padding:12px 14px}
 .kpi b{display:block;font-size:24px;color:var(--accent)} .kpi span{font-size:12px;color:var(--muted)}
</style></head><body><header><h1>${esc(title)}</h1><p>${subtitle}</p></header><main>${body}</main></body></html>`;

const status = (s) => `<span class="badge ${s >= 500 ? 'err' : s >= 400 ? 'warn' : ''}">HTTP ${s}</span>`;

/* ---------- Page 1: full request/response console ------------------------------ */
const consoleBody = exchanges
  .map(
    (e, i) => `<div class="card">
  <div class="row"><span class="method">${e.request.method}</span><span class="path">${esc(e.request.path)}</span>${status(e.response.status)}<span style="color:var(--muted);font-size:12px">${e.response.ms} ms · actor: ${esc(e.request.actor)}</span></div>
  <div class="label">Figure data ${i + 1} — ${esc(e.label)}</div>
  ${e.request.body ? `<div class="label">Request body</div><pre>${j(e.request.body)}</pre>` : ''}
  <div class="label">Response body</div><pre>${j(e.response.body)}</pre>
</div>`,
  )
  .join('');

writeFileSync(
  new URL('page-api-console.html', OUT),
  shell(
    'CCLBS REST API — captured request / response evidence',
    `Verbatim HTTP exchanges recorded by scripts/capture-evidence.mjs on ${esc(capturedAt)}. Responses shown in full, unedited.`,
    `<div class="card"><div class="kpi">
      <div><b>${exchanges.length}</b><span>captured exchanges</span></div>
      <div><b>${exchanges.filter((e) => e.response.status < 400).length}</b><span>2xx / 3xx responses</span></div>
      <div><b>${exchanges.filter((e) => e.response.status >= 400).length}</b><span>rejected requests (4xx)</span></div>
      <div><b>${Math.max(...exchanges.map((e) => e.response.ms))}</b><span>slowest response (ms)</span></div>
    </div></div>${consoleBody}`,
  ),
);

/* ---------- Page 2: negative-path catalogue ----------------------------------- */
const negatives = exchanges.filter((e) => e.response.status >= 400);
writeFileSync(
  new URL('page-negative-paths.html', OUT),
  shell(
    'CCLBS — rejected requests and error envelope',
    'Every rejected request returned the same JSON shape: { error: { code, message, details } }.',
    `<div class="card"><table><thead><tr><th>#</th><th>Case</th><th>Request</th><th>Status</th><th>Code</th><th>Detail</th></tr></thead><tbody>
    ${negatives
      .map(
        (e, i) => `<tr><td>${i + 1}</td><td>${esc(e.label)}</td><td><code>${e.request.method} ${esc(e.request.path)}</code></td><td>${status(e.response.status)}</td><td>${esc(e.response.body?.error?.code ?? '—')}</td>
        <td>${esc(e.response.body?.error?.details?.[0] ? JSON.stringify(e.response.body.error.details[0]) : e.response.body?.error?.message ?? '—')}</td></tr>`,
      )
      .join('')}
    </tbody></table></div>`,
  ),
);

/* ---------- Page 3: database schema ------------------------------------------- */
writeFileSync(
  new URL('page-database-schema.html', OUT),
  shell(
    'CCLBS — SQLite schema created at runtime',
    `Extracted from sqlite_master after the server booted. Rows: ${counts.users} users · ${counts.rooms} rooms · ${counts.bookings} bookings.`,
    schema.map((s, i) => `<div class="card"><div class="label">Object ${i + 1}</div><pre>${esc(s)}</pre></div>`).join(''),
  ),
);

/* ---------- Page 4: analytics --------------------------------------------------- */
const summary = exchanges.find((e) => e.label === 'Report summary')?.response.body;
const util = exchanges.find((e) => e.label === 'Utilisation report')?.response.body ?? [];
const byRoom = exchanges.find((e) => e.label === 'Bookings by room')?.response.body ?? [];
writeFileSync(
  new URL('page-analytics.html', OUT),
  shell(
    'CCLBS — administrator analytics endpoints',
    'Returned by GET /api/reports/summary, /utilisation and /bookings-by-room.',
    `<div class="card"><div class="kpi">
      <div><b>${summary.bookings.totalBookings}</b><span>total bookings</span></div>
      <div><b>${summary.bookings.confirmed}</b><span>confirmed</span></div>
      <div><b>${summary.bookings.pending}</b><span>pending</span></div>
      <div><b>${summary.bookings.cancelled}</b><span>cancelled</span></div>
      <div><b>${summary.bookings.rejected}</b><span>rejected</span></div>
      <div><b>${summary.bookings.cancellationRatePct}%</b><span>cancellation rate</span></div>
    </div></div>
    <div class="card"><div class="label">GET /api/reports/utilisation</div><table><thead><tr><th>Code</th><th>Room</th><th>Building</th><th>Capacity</th><th>Booked hours</th><th>Bookings</th></tr></thead><tbody>
    ${util.map((r) => `<tr><td>${esc(r.roomCode)}</td><td>${esc(r.roomName)}</td><td>${esc(r.building)}</td><td>${r.capacity}</td><td>${r.bookedHours}</td><td>${r.bookingCount}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card"><div class="label">GET /api/reports/bookings-by-room</div><table><thead><tr><th>Code</th><th>Room</th><th>Total</th><th>Confirmed</th><th>Pending</th><th>Cancelled</th><th>Rejected</th></tr></thead><tbody>
    ${byRoom.map((r) => `<tr><td>${esc(r.roomCode)}</td><td>${esc(r.roomName)}</td><td>${r.total ?? 0}</td><td>${r.confirmed ?? 0}</td><td>${r.pending ?? 0}</td><td>${r.cancelled ?? 0}</td><td>${r.rejected ?? 0}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card"><div class="label">Peak start hours (from /summary)</div><pre>${j(summary.peakHours)}</pre></div>`,
  ),
);

console.log('Wrote 4 evidence pages.');
