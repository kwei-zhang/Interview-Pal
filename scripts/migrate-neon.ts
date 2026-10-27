import { readFile, writeFile } from 'node:fs/promises';
import { Client } from 'pg';
import { importBackup, migrateSchema, parseBackup, prepareImport } from './lib/migration';

async function main() {
  const args=process.argv.slice(2), backup=args.find(s=>!s.startsWith('--'));
  const connectionString=process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL separately from the runtime DATABASE_URL.');
  const db=new Client({connectionString}); await db.connect();
  try {
    await migrateSchema(db);
    if (!backup) {console.log('Schema migrations applied.');return;}
    const report=await importBackup(db,prepareImport(parseBackup(await readFile(backup))),args.includes('--apply'));
    const output=JSON.stringify(report,null,2)+'\n';
    const path=process.env.MIGRATION_REPORT_PATH;
    if (path) await writeFile(path,output,{mode:0o600});
    console.log(output);
  } finally {await db.end();}
}
void main().catch(error=>{console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted database URL]') : 'Migration failed');process.exitCode=1;});
