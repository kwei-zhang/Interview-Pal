import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { Database } from '../../src/lib/server/database';

// Maintain the active Neon schema; applied SQL files remain immutable.
export async function applySchema(db: Database) {
  await db.query('begin');
  try {
    await db.query("select pg_advisory_xact_lock(196427006)");
    await db.query('create schema if not exists private');
    await db.query('revoke all on schema private from public');
    await db.query('create table if not exists private.schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())');
    for (const name of (await readdir('neon/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const sql=await readFile(`neon/migrations/${name}`,'utf8'), hash=createHash('sha256').update(sql).digest('hex');
      const old=(await db.query<{checksum:string}>('select checksum from private.schema_migrations where name=$1',[name])).rows[0];
      if (old && old.checksum!==hash) throw new Error(`Applied migration changed: ${name}`);
      if (!old) {await db.query(sql); await db.query('insert into private.schema_migrations(name,checksum) values($1,$2)',[name,hash]);}
    }
    await db.query('commit');
  } catch(error) {await db.query('rollback');throw error;}
}
