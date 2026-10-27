import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {applySchema} from '../../scripts/lib/schema';
export const adminId = '11111111-1111-4111-8111-111111111111';
export const memberId = '22222222-2222-4222-8222-222222222222';
export async function setupNeon(db: PGlite) {
  // PGlite's prepared-query API accepts one statement; schema files contain many.
  await applySchema({query: async <T>(sql: string, params?: unknown[]) => {
    if (params) return db.query<T>(sql, params);
    return {rows: (await db.exec(sql)).flatMap(result => result.rows) as T[]};
  }});
  await db.query(`insert into public.app_accounts(user_id,email,role,status,verified_at,legacy) values
    ($1,'admin@example.test','admin','active',now(),true),($2,'member@example.test','member','active',now(),true)`,[adminId,memberId]);
  await db.exec(readFileSync('neon/seed.sql','utf8'));
}
export async function asNeonUser(db: PGlite,userId: string|null) {
  await db.exec('reset role');
  await db.query("select set_config('app.user_id',$1,false)",[userId||'']);
  await db.exec('set role interview_app');
}
