import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {Client} from 'pg';
async function main() {
  const connectionString=process.env.MIGRATION_DATABASE_URL,baseUrl=process.env.NEON_AUTH_BASE_URL;
  const output=process.argv[2];
  if(!connectionString || !baseUrl || !output) throw new Error('Set MIGRATION_DATABASE_URL and NEON_AUTH_BASE_URL; pass a new private env-file path.');
  const db=new Client({connectionString});await db.connect();
  try {
    const role='interview_runtime',password=randomBytes(32).toString('hex');
    await db.query('begin');
    if((await db.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) throw new Error('Runtime role already exists. Reuse its saved credential; do not rotate implicitly.');
    // Generated hex only; PostgreSQL does not accept parameters in CREATE ROLE.
    await db.query(`create role interview_runtime login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
    await db.query('grant interview_app to interview_runtime');
    const url=new URL(connectionString);url.username=role;url.password=password;
    if(url.hostname.endsWith('.neon.tech')&&!url.hostname.includes('-pooler.')) url.hostname=url.hostname.replace('.', '-pooler.');
    const env=`DATABASE_URL=${url.href}\nNEON_AUTH_BASE_URL=${baseUrl}\nNEON_AUTH_COOKIE_SECRET=${randomBytes(32).toString('hex')}\nAUTH_SITE_URL=https://www.kwei.me/interview\nNEXT_PUBLIC_BASE_PATH=/interview\n`;
    await writeFile(output,env,{mode:0o600,flag:'wx'});
    await db.query('commit');console.log('Restricted runtime role created; connection settings saved without displaying credentials.');
  } catch(error) {await db.query('rollback');throw error;} finally {await db.end();}
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
