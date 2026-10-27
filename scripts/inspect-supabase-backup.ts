import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {temporaryPostgres} from '../tests/helpers/postgres';
import {migrateSchema,parseBackup,prepareImport,importBackup} from './lib/migration';
async function main() {
  const path=process.argv[2];if(!path) throw new Error('Supply the full backup path.');
  const tables=prepareImport(parseBackup(await readFile(path)));
  const pg=await temporaryPostgres(),db=await pg.connect();
  try {
    await migrateSchema(db);await migrateSchema(db);
    const dryRun=await importBackup(db,tables,false);
    assert.equal((await db.query('select * from public.app_accounts')).rowCount,0,'Dry run must not commit rows');
    await importBackup(db,tables,true);
    const retry=await importBackup(db,tables,false);
    assert.ok(retry.tables.every(t=>t.identical),'Retry must produce identical checksums');
    const report={...dryRun,engine:(await db.query('show server_version')).rows[0].server_version,retryIdentical:true,source:'full Supabase backup (COPY data only)',excluded:'provider credentials, sessions, Supabase infrastructure'};
    if(process.env.MIGRATION_REPORT_PATH) await writeFile(process.env.MIGRATION_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(report,null,2));
  } finally {await db.end();await pg.stop();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1});
