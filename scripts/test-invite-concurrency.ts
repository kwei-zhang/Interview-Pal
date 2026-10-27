// Real PostgreSQL connections; no configured cloud database is contacted.
import assert from 'node:assert/strict';
import {temporaryPostgres} from '../tests/helpers/postgres';
import {applySchema} from './lib/schema';
async function main() {
  const pg=await temporaryPostgres(),db=await pg.connect();
  try {
    await applySchema(db);
    await db.query("insert into public.app_accounts(user_id,email,role,verified_at) values('11111111-1111-4111-8111-111111111111','admin@example.test','admin',now())");
    await db.query("select set_config('app.user_id','11111111-1111-4111-8111-111111111111',false)");
    await db.query("select public.admin_create_invitation('race@example.test',repeat('a',64))");
    for(const [token,id] of [['b','identity-one'],['c','identity-two']]) {
      await db.query("select private.create_admission('race@example.test','Race',repeat('a',64),false,repeat($1,64))",[token]);
      await db.query("select private.accept_admission(repeat($1,64),'race@example.test',null)",[token]);
      await db.query("select private.bind_admission(repeat($1,64),'race@example.test',$2)",[token,id]);
    }
    const race=await Promise.all(['identity-one','identity-two'].map(async id=>{
      const client=await pg.connect();try {
        await client.query('begin');await client.query('set local role interview_app');
        await client.query("select private.resolve_identity($1,'race@example.test',true)",[id]);
        await client.query('select pg_sleep(0.15)');await client.query('commit');return 'ok';
      } catch(e) {await client.query('rollback');return (e as Error).message;} finally {await client.end();}
    }));
    assert.equal(race.filter(v=>v==='ok').length,1,JSON.stringify(race));
    assert.match(race.find(v=>v!=='ok')!,/Invitation is no longer available/);
    const count=await db.query(`select (select count(*) from public.app_accounts where email='race@example.test') accounts,
      (select count(*) from private.auth_identities) identities,
      (select count(*) from private.invitations where redeemed_at is not null) redemptions`);
    assert.deepEqual(count.rows[0],{accounts:'1',identities:'1',redemptions:'1'});
    // Concurrent email proof for two reconnect attempts must not link one UUID twice.
    await db.query("insert into public.app_accounts(email,legacy) values('legacy@example.test',true)");
    for(const [token,id] of [['d','reconnect-one'],['e','reconnect-two']]) {
      await db.query("select private.create_admission('legacy@example.test','Legacy',null,true,repeat($1,64))",[token]);
      await db.query("select private.accept_admission(repeat($1,64),'legacy@example.test',null)",[token]);
      await db.query("select private.bind_admission(repeat($1,64),'legacy@example.test',$2)",[token,id]);
    }
    const links=await Promise.all(['reconnect-one','reconnect-two'].map(async id=>{
      const client=await pg.connect();try {await client.query("select private.resolve_identity($1,'legacy@example.test',true)",[id]);return true;}catch{return false;}finally{await client.end();}
    }));assert.equal(links.filter(Boolean).length,1);
    console.log('PASS: concurrent signup creates one membership/redemption; reconnect links one stable account exactly once.');
  } finally {await db.end();await pg.stop();}
}
void main().catch(e=>{console.error(e.message);process.exitCode=1});
