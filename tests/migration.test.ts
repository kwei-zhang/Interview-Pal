import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {applicationTables,parseBackup,prepareImport,decodeCopy,type DumpTable} from '../scripts/lib/migration';
const empty=()=>new Map([...applicationTables,'auth.users','auth.identities'].map(t=>[t,{columns:['id'],rows:[]} as DumpTable]));
test('COPY parser handles empty tables, escaped text and compressed dumps without executing SQL',()=>{
  const dump=[...applicationTables,'auth.users','auth.identities'].map(t=>`COPY ${t} (id) FROM stdin;\n\\.\n`).join('\n');
  const parsed=parseBackup(gzipSync(Buffer.from(`DROP DATABASE postgres;\n${dump}`)));
  assert.equal(parsed.size,21);assert.ok([...parsed.values()].every(t=>t.rows.length===0));
  assert.equal(decodeCopy('\\N'),null);assert.equal(decodeCopy('line\\nwith\\ttab\\\\slash'),'line\nwith\ttab\\slash');
  assert.throws(()=>parseBackup(Buffer.from(dump+'COPY public.unknown (id) FROM stdin;\n\\.\n')),/Unrecognized/);
  assert.throws(()=>parseBackup(Buffer.from('COPY public.profiles (id) FROM stdin;\nmissing-end')),/Truncated/);
});
test('Import normalization refuses duplicate email ownership and strips historical invitation secrets',()=>{
  const tables=empty();tables.set('auth.users',{columns:['id','email','raw_user_meta_data','raw_app_meta_data'],rows:[['a',' Original@Example.test ','{"invite_code":"secret","display_name":"Original"}','{}']]});
  tables.set('public.app_accounts',{columns:['user_id','role','status','created_at'],rows:[['a','admin','suspended','2026-01-01']]});
  const prepared=prepareImport(tables),account=prepared.get('public.app_accounts')!;
  assert.equal(account.rows[0][account.columns.indexOf('email')],'original@example.test');
  assert.equal(account.rows[0][account.columns.indexOf('role')],'admin');
  assert.equal(account.rows[0][account.columns.indexOf('status')],'suspended');
  assert.doesNotMatch(JSON.stringify(prepared.get('private.legacy_auth_users')),/secret|invite_code/);
  tables.get('auth.users')!.rows.push(['b','original@example.test','{}','{}']);tables.get('public.app_accounts')!.rows.push(['b','member','active','2026-01-01']);
  assert.throws(()=>prepareImport(tables),/Ambiguous/);
});
