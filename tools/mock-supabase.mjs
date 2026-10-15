// npm run mock-supabase [port=54321] — rehearse the hosted setup on your own computer.
// Starts an in-memory PostgreSQL, runs the SQL files 1 to 6 in the order you would run them in Supabase, and answers
// like Supabase's REST API (GET /rest/v1/<view>?select=*) using ONLY the public "anon" role, so you see exactly what a
// visitor of your GitHub Pages site would be allowed to read. Point docs/config.js at http://localhost:<port>
// (any text as the anon key) and open the pages from a local server.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { SQL_DIR } from './lib.mjs';

const port = Number(process.argv[2] || 54321);
const db = new PGlite();
await db.exec("create role anon; create role authenticated;");
for (const f of ['1_schema.sql', '2_views_and_security.sql', '3_sample_data.sql', '4_digital_twin.sql', '5_digital_twin_sample_data.sql', '6_public_read_access.sql']) await db.exec(readFileSync(join(SQL_DIR, f), 'utf8'));
let busy = Promise.resolve();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, prefer', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const m = /^\/rest\/v1\/([a-z0-9_]+)/.exec(req.url);
  if (!m || req.method !== 'GET') { res.writeHead(404, { ...cors, 'Content-Type': 'application/json' }); return res.end('{"message":"not found"}'); }
  if (!req.headers.apikey) { res.writeHead(401, { ...cors, 'Content-Type': 'application/json' }); return res.end('{"message":"No API key found in request"}'); }
  busy = busy.then(async () => {
    try {
      await db.exec('set role anon');
      const r = await db.query(`select * from "${m[1]}"`);
      const num = new Set(r.fields.filter((f) => f.dataTypeID === 1700).map((f) => f.name));   // PostgREST sends numeric as JSON numbers
      const rows = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, num.has(k) && v !== null ? Number(v) : v])));
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(rows));
    } catch (e) { res.writeHead(401, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: '42501', message: e.message })); }
    finally { await db.exec('reset role'); }
  });
}).listen(port, () => console.log(`mock Supabase on http://localhost:${port}  (anon role only, like the public pages)`));
