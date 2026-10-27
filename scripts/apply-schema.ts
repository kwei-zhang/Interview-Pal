import { Client } from 'pg';
import { applySchema } from './lib/schema';

async function main() {
  if (process.argv.length > 2) throw new Error('db:apply accepts no arguments.');
  const connectionString = process.env.SCHEMA_DATABASE_URL;
  if (!connectionString) throw new Error('Set SCHEMA_DATABASE_URL separately from the runtime DATABASE_URL.');
  const db = new Client({connectionString});
  await db.connect();
  try {
    await applySchema(db);
    console.log('Neon schema is up to date.');
  } finally { await db.end(); }
}
void main().catch(error => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted database URL]') : 'Schema update failed');
  process.exitCode = 1;
});
