// In-memory PostgreSQL (PGlite) used to test the SQL exactly as it will run on Supabase.
import { PGlite } from '@electric-sql/pglite';
import { parse } from 'csv-parse/sync';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CSV_DIR = join(ROOT, 'data', 'csv');
export const SQL_DIR = join(ROOT, 'supabase');
export const SCHEMA_FILES = ['1_schema.sql', '2_views_and_security.sql', '4_digital_twin.sql'];

export async function newDb() {
  const db = new PGlite();
  // Supabase provides these roles; create them so the grants/policies can run.
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; end $$;`);
  for (const f of SCHEMA_FILES) {
    try { await db.exec(readFileSync(join(SQL_DIR, f), 'utf8')); }
    catch (e) { throw new Error(`${f} failed: ${e.message}`); }
  }
  return db;
}

export const csvFiles = () => readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv')).sort();
export const tableOf = (f) => f.replace(/^\d+_/, '').replace(/\.csv$/, '');
export function readCsv(file) {
  const text = readFileSync(join(CSV_DIR, file), 'utf8');
  return { columns: text.split(/\r?\n/, 1)[0].split(','), rows: parse(text, { columns: true, skip_empty_lines: true }) };
}
const lit = (v) => (v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
export function csvToInsertSql(file) {
  const { columns, rows } = readCsv(file);
  if (!rows.length) return '';
  return `insert into ${tableOf(file)} (${columns.join(', ')}) values\n` +
    rows.map((r) => '  (' + columns.map((c) => lit(r[c])).join(', ') + ')').join(',\n') + ';\n';
}
export async function loadCsvs(db, only = () => true) {
  const counts = {};
  for (const f of csvFiles()) if (only(f)) { await db.exec(csvToInsertSql(f)); counts[tableOf(f)] = readCsv(f).rows.length; }
  await db.exec('select reset_identity_sequences();');
  return counts;
}
