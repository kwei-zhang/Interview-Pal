import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
export {adminId,memberId} from './auth-database';
import {adminId,memberId} from './auth-database';
export async function setupNeon(db: PGlite) {
  for (const file of ['001_application.sql','002_admissions.sql','003_legacy_metadata.sql','004_webhook_receipts.sql','005_provider_creation_binding.sql']) await db.exec(readFileSync(`neon/migrations/${file}`,'utf8'));
  await db.query(`insert into public.app_accounts(user_id,email,role,status,verified_at,legacy) values
    ($1,'admin@example.test','admin','active',now(),true),($2,'member@example.test','member','active',now(),true)`,[adminId,memberId]);
  await db.exec(readFileSync('supabase/seed.sql','utf8'));
}
export async function asNeonUser(db: PGlite,userId: string|null) {
  await db.exec('reset role');
  await db.query("select set_config('app.user_id',$1,false)",[userId||'']);
  await db.exec('set role interview_app');
}
