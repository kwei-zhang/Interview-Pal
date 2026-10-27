import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { Database } from '../../src/lib/server/database';
export type DumpTable = {columns: string[]; rows: (string | null)[][]};
export const applicationTables = ['role_tracks','question_collections','problems','problem_definitions','behavioral_questions','app_accounts','profiles','problem_progress','code_drafts','stories','story_question_links','interview_sessions','interview_events','session_feedback','attempts','execution_slots','agent_request_slots'].map(t => `public.${t}`).concat(['private.invitations','private.access_audit']);
const allowed = new Set([...applicationTables,'auth.users','auth.identities']);
const quote = (s: string) => `"${s.replaceAll('"','""')}"`;
const tableSql = (s: string) => s.split('.').map(quote).join('.');
export const checksum = (value: string) => createHash('sha256').update(value).digest('hex');

// Interpret only PostgreSQL text COPY data. Never execute SQL from a downloaded backup.
export function parseBackup(source: Buffer): Map<string, DumpTable> {
  const text = (source[0] === 0x1f && source[1] === 0x8b ? gunzipSync(source, {maxOutputLength: 1024 * 1024 * 1024}) : source).toString('utf8');
  const tables = new Map<string, DumpTable>();
  const lines = text.split(/\r?\n/);
  for (let i=0; i<lines.length; i++) {
    if (!lines[i].startsWith('COPY ')) continue;
    const match = /^COPY ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*) \(([^)]+)\) FROM stdin;$/.exec(lines[i]);
    if (!match) throw new Error('Unsupported COPY format; inspect the backup manually.');
    const name = match[1], columns = match[2].split(', ').map(s=>s.replace(/^"|"$/g,''));
    if (/^(public|private)\./.test(name) && !allowed.has(name)) throw new Error(`Unrecognized application table ${name}; refusing an incomplete import.`);
    const rows: DumpTable['rows'] = [];
    while (++i<lines.length && lines[i] !== '\\.') {
      if (!allowed.has(name)) continue;
      const row = lines[i].split('\t').map(decodeCopy);
      if (row.length !== columns.length) throw new Error(`Invalid column count in ${name}`);
      rows.push(row);
    }
    if (i === lines.length) throw new Error('Truncated backup COPY section');
    if (allowed.has(name)) {
      if (tables.has(name)) throw new Error(`Duplicate COPY section ${name}`);
      tables.set(name, {columns, rows});
    }
  }
  for (const name of allowed) if (!tables.has(name)) throw new Error(`Missing backup table ${name}`);
  return tables;
}
export function decodeCopy(value: string): string | null {
  if (value === '\\N') return null;
  return value.replace(/\\([0-7]{1,3}|x[0-9a-fA-F]{1,2}|.)/g, (_, ch: string) => {
    if (/^[0-7]/.test(ch)) return String.fromCharCode(parseInt(ch,8));
    if (/^x[0-9a-fA-F]/.test(ch)) return String.fromCharCode(parseInt(ch.slice(1),16));
    return ({b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v'} as Record<string,string>)[ch] ?? ch;
  });
}
function objects(table: DumpTable) { return table.rows.map(row=>Object.fromEntries(table.columns.map((c,i)=>[c,row[i]]))); }
function fromObjects(rows: Record<string,string|null>[], columns: string[]): DumpTable {return {columns,rows:rows.map(r=>columns.map(c=>r[c] ?? null))};}
function metadata(raw: string | null) {
  const object = JSON.parse(raw || '{}');
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('Invalid historical identity metadata');
  // Invitation secrets were historically user metadata in Supabase.
  for (const key of Object.keys(object)) if (/password|token|secret|invite.?code/i.test(key)) delete object[key];
  return JSON.stringify(object);
}
export function prepareImport(tables: Map<string,DumpTable>): Map<string,DumpTable> {
  const result = new Map(applicationTables.map(t=>[t,tables.get(t)!]));
  const users = objects(tables.get('auth.users')!), accounts = objects(tables.get('public.app_accounts')!);
  if (users.length !== accounts.length || users.some(u=>!accounts.some(a=>a.user_id===u.id))) throw new Error('Auth/application account IDs differ; resolve before importing.');
  const emails = new Set<string>();
  for (const u of users) {
    const email = (u.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email) || u.is_anonymous === 't' || u.deleted_at) throw new Error('Ambiguous, anonymous, deleted or missing account email; resolve before importing.');
    emails.add(email);
  }
  result.set('public.app_accounts',fromObjects(accounts.map(a=>{
    const user=users.find(u=>u.id===a.user_id)!;
    return {...a,email:user.email!.trim().toLowerCase(),verified_at:user.email_confirmed_at,legacy:'true'};
  }),['user_id','email','role','status','created_at','verified_at','legacy']));
  result.set('private.legacy_auth_users',fromObjects(users.map(u=>({user_id:u.id,original_email:u.email,email_confirmed_at:u.email_confirmed_at,created_at:u.created_at,updated_at:u.updated_at,user_metadata:metadata(u.raw_user_meta_data),app_metadata:metadata(u.raw_app_meta_data)})),['user_id','original_email','email_confirmed_at','created_at','updated_at','user_metadata','app_metadata']));
  result.set('private.legacy_auth_identities',fromObjects(objects(tables.get('auth.identities')!).map(i=>({...i,identity_data:metadata(i.identity_data)})),['id','user_id','provider','provider_id','identity_data','created_at','updated_at','last_sign_in_at']));
  return result;
}
export async function migrateSchema(db: Database) {
  await db.query('begin');
  try {
    await db.query("select pg_advisory_xact_lock(196427006)");
    await db.query('create schema if not exists private');
    await db.query('revoke all on schema private from public');
    await db.query('create table if not exists private.schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())');
    for (const name of (await readdir('neon/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
      const sql=await readFile(`neon/migrations/${name}`,'utf8'), hash=checksum(sql);
      const old=(await db.query<{checksum:string}>('select checksum from private.schema_migrations where name=$1',[name])).rows[0];
      if (old && old.checksum!==hash) throw new Error(`Applied migration changed: ${name}`);
      if (!old) {await db.query(sql); await db.query('insert into private.schema_migrations(name,checksum) values($1,$2)',[name,hash]);}
    }
    await db.query('commit');
  } catch(error) {await db.query('rollback');throw error;}
}
export async function importBackup(db: Database, tables: Map<string,DumpTable>, apply=false) {
  const report: {table:string; rows:number; checksum:string; existingRows:number; identical:boolean}[]=[];
  await db.query('begin');
  try {
    await db.query('select pg_advisory_xact_lock(196427006)');
    await db.query("set local timezone='UTC'");
    await db.query('set constraints all deferred');
    const empty: string[]=[];
    let index=0;
    for (const [name,table] of tables) {
      if (!applicationTables.includes(name) && !/^private\.legacy_auth_(users|identities)$/.test(name)) throw new Error('Unexpected import table');
      const sql=tableSql(name), stage=quote(`import_stage_${index++}`);
      const actual=(await db.query<{column_name:string}>('select column_name from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position',name.split('.'))).rows.map(r=>r.column_name);
      if (table.columns.length!==actual.length || table.columns.some(c=>!actual.includes(c))) throw new Error(`Column mismatch in ${name}`);
      await db.query(`lock table ${sql} in share row exclusive mode`);
      await db.query(`create temporary table ${stage} (like ${sql}) on commit drop`);
      const cols=table.columns.map(quote).join(',');
      for (const row of table.rows) await db.query(`insert into ${stage} (${cols}) values (${row.map((_,i)=>`$${i+1}`).join(',')})`,row);
      const digest=async (target:string) => (await db.query<{data:string; count:string}>(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text as data,count(*)::text as count from ${target} t`)).rows[0];
      const expected=await digest(stage), current=await digest(sql);
      if (Number(current.count)>0 && expected.data!==current.data) throw new Error(`Conflicting import at ${name}; target differs. No rows were committed.`);
      report.push({table:name,rows:Number(expected.count),checksum:checksum(expected.data),existingRows:Number(current.count),identical:expected.data===current.data});
      if (Number(current.count)===0) {
        await db.query(`insert into ${sql} (${cols}) overriding system value select ${cols} from ${stage}`);
        empty.push(name);
      }
      if ((await digest(sql)).data!==expected.data) throw new Error(`Checksum mismatch ${name}`);
    }
    // This validates every FK, including deferred invitation references, before commit.
    await db.query('set constraints all immediate');
    if (apply) {
      for (const name of ['public.execution_slots','public.agent_request_slots','private.access_audit']) if (empty.includes(name))
        await db.query(`select setval(pg_get_serial_sequence($1,'id'),coalesce(max(id),1),max(id) is not null) from ${tableSql(name)}`,[name]);
    }
    await db.query(apply?'commit':'rollback');
    return {applied:apply, duplicateEmails:0, foreignKeys:'valid',tables:report};
  } catch(error) {await db.query('rollback');throw error;}
}
