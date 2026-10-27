import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {setupNeon,asNeonUser,adminId,memberId} from './helpers/neon-database';
const db=new PGlite();
before(()=>setupNeon(db));after(()=>db.close());
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function invite(email:string) {
  await asNeonUser(db,adminId); const code=hash(randomUUID());
  const {rows}=await db.query<{value:{id:string}}>('select public.admin_create_invitation($1,$2) value',[email,code]);
  return {id:rows[0].value.id,code};
}
async function admission(email:string,code:string|null,reconnect=false) {
  const token=hash(randomBytes(32).toString('hex'));
  await asNeonUser(db,null);
  await db.query('select private.create_admission($1,$2,$3,$4,$5)',[email,'Name',code,reconnect,token]);return token;
}
async function accept(token:string,email:string,identity:string) {
  const allowed=(await db.query<{ok:boolean}>('select private.accept_admission($1,$2,null) ok',[token,email])).rows[0].ok;
  if (!allowed) return false;
  return (await db.query<{ok:boolean}>('select private.bind_admission($1,$2,$3) ok',[token,email,identity])).rows[0].ok;
}
async function resolve(identity:string,email:string,verified:boolean) {
  return (await db.query<{account:{user_id:string;role:string;status:string}|null}>('select private.resolve_identity($1,$2,$3) account',[identity,email,verified])).rows[0].account;
}
test('Reconnection requires proof of original email and preserves UUID/admin privilege',async()=>{
  const token=await admission('admin@example.test',null,true);
  assert.equal(await accept(token,'wrong@example.test','neon-admin'),false);
  assert.equal(await accept(token,'admin@example.test','neon-admin'),true);
  assert.equal(await resolve('neon-admin','admin@example.test',false),null);
  assert.equal(await resolve('unadmitted','admin@example.test',true),null);
  const account=await resolve('neon-admin','ADMIN@example.test',true);
  assert.equal(account!.user_id,adminId);assert.equal(account!.role,'admin');
  assert.deepEqual(await resolve('neon-admin','admin@example.test',true),account);
  await assert.rejects(resolve('neon-admin','wrong@example.test',true),/identity mismatch/);
  await assert.rejects(admission('admin@example.test',null,true),/Unable to reconnect/);
});
test('Suspended imported account remains suspended and personal data inaccessible after reconnect',async()=>{
  await db.exec('reset role');await db.query("update public.app_accounts set status='suspended' where user_id=$1",[memberId]);
  const token=await admission('member@example.test',null,true);
  assert.equal(await accept(token,'member@example.test','neon-member'),true);
  const account=await resolve('neon-member','member@example.test',true);
  assert.equal(account!.user_id,memberId);assert.equal(account!.status,'suspended');
  await asNeonUser(db,memberId);
  assert.equal((await db.query('select * from public.problems')).rows.length,0);
  await assert.rejects(db.query('select public.claim_agent_slot()'),/Active membership/);
  await assert.rejects(db.query("insert into public.profiles(user_id,data) values($1,'{}')",[memberId]),/row-level security/);
  await assert.rejects(db.query("update public.app_accounts set status='active'"),/permission denied/);
});
test('Provider failure leaves invitations unconsumed; duplicate hooks/finalization are safe',async()=>{
  const email='new@example.test', invitation=await invite(email),token=await admission(email,invitation.code);
  assert.equal(await accept(token,email,'failed-provider'),true);
  await db.exec('reset role');
  assert.equal((await db.query<{redeemed_at:string|null}>('select redeemed_at from private.invitations where id=$1',[invitation.id])).rows[0].redeemed_at,null);
  const retry=await admission(email,invitation.code);
  assert.equal(await accept(retry,email,'created-provider'),true);
  assert.equal(await accept(retry,email,'created-provider'),true);
  assert.equal(await accept(retry,email,'different-provider'),false);
  const account=await resolve('created-provider',email,false);
  assert.equal(account!.role,'member');
  assert.deepEqual(await resolve('created-provider',email,false),account);
  await asNeonUser(db,account!.user_id);assert.equal((await db.query('select * from public.profiles')).rows.length,0);
  await resolve('created-provider',email,true);
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  await assert.rejects(resolve('failed-provider',email,true),/Invitation is no longer available/);
  await db.exec('reset role');assert.equal((await db.query("select * from private.access_audit where action='neon_account_created' and actor_id=$1",[account!.user_id])).rows.length,1);
});
test('No admission, expired tokens, wrong email and revoked invites cannot grant membership',async()=>{
  assert.equal(await resolve('no-admission','bypass@example.test',true),null);
  const email='expiry@example.test',invitation=await invite(email),token=await admission(email,invitation.code);
  assert.equal(await accept(hash('missing'),email,'bad'),false);
  await db.exec('reset role');await db.query("update private.signup_admissions set expires_at=now()-interval '1 second' where token_hash=$1",[token]);
  await asNeonUser(db,null);assert.equal(await accept(token,email,'expired'),false);
  const second=await admission(email,invitation.code);
  await asNeonUser(db,adminId);await db.query('select public.admin_revoke_invitation($1)',[invitation.id]);
  assert.equal(await accept(second,email,'revoked'),false);
  await assert.rejects(db.query('select * from private.signup_admissions'),/permission denied/);
  await assert.rejects(db.query('select * from private.auth_identities'),/permission denied/);
});
test('Finalization failures roll back both membership and redemption',async()=>{
  const email='transaction@example.test',invitation=await invite(email),token=await admission(email,invitation.code);
  await accept(token,email,'transaction-provider');
  await assert.rejects(db.transaction(async tx=>{
    await tx.query('select private.resolve_identity($1,$2,true)',['transaction-provider',email]);
    throw new Error('simulated failure');
  }),/simulated failure/);
  await db.exec('reset role');assert.equal((await db.query('select * from public.app_accounts where email=$1',[email])).rows.length,0);
  assert.equal((await db.query<{value:string|null}>('select redeemed_at value from private.invitations where id=$1',[invitation.id])).rows[0].value,null);
  await asNeonUser(db,null);assert.ok(await resolve('transaction-provider',email,true));
});
test('Duplicate signed-event deliveries return the original decision, even after revocation',async()=>{
  const email='delivery@example.test',invitation=await invite(email),token=await admission(email,invitation.code),event=randomUUID();
  const invoke=(digest=hash('payload'))=>db.query<{response:{allowed:boolean}}>('select private.process_auth_event($1,$2,$3,$4,$5,$6) response',[event,'user.before_create','delivery-user',email,token,digest]);
  assert.equal((await invoke()).rows[0].response.allowed,true);
  await asNeonUser(db,adminId);await db.query('select public.admin_revoke_invitation($1)',[invitation.id]);
  assert.equal((await invoke()).rows[0].response.allowed,true);
  await assert.rejects(invoke(hash('changed payload')),/Event payload changed/);
  // A cached allow cannot redeem a subsequently revoked invite.
  await db.query('select private.bind_admission($1,$2,$3)',[token,email,'delivery-user']);
  await assert.rejects(resolve('delivery-user',email,true),/Invitation is no longer available/);
});
test('Verified session recovers lost created webhook/response only inside the admission window',async()=>{
  const email='lost-callback@example.test',invitation=await invite(email),token=await admission(email,invitation.code);
  await db.query('select private.accept_admission($1,$2,null)',[token,email]);
  const recover=(id:string,verified:boolean,createdAt:string)=>db.query<{account:{user_id:string}|null}>('select private.resolve_verified_identity($1,$2,$3,$4) account',[id,email,verified,createdAt]);
  assert.equal((await recover('old-provider',true,'2020-01-01')).rows[0].account,null);
  assert.equal((await recover('lost-provider',false,new Date().toISOString())).rows[0].account,null);
  assert.ok((await recover('lost-provider',true,new Date().toISOString())).rows[0].account);
  assert.equal((await recover('other-provider',true,new Date().toISOString())).rows[0].account,null);
});
