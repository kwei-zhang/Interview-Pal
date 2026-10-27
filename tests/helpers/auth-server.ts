// Test-only Neon Auth HTTP fixture. Runs real PostgreSQL and signed webhooks,
// substitutes provider credentials/email delivery. No real account or mail is used.
import {createServer} from 'node:http';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {temporaryPostgres} from './postgres';
import {applySchema} from '../../scripts/lib/schema';
import {adminId,memberId} from './neon-database';

type User={id:string;email:string;name:string;emailVerified:boolean;password:string};
async function main() {
 const pg=await temporaryPostgres(54328),db=await pg.connect();
 await applySchema(db);await db.query(await readFile('neon/seed.sql','utf8'));
 await db.query(`insert into public.app_accounts(user_id,email,role,verified_at,legacy) values($1,'zhangkw0622@gmail.com','admin',now(),true),($2,'member@example.test','member',now(),true)`,[adminId,memberId]);
 await db.query("create role interview_test login; grant interview_app to interview_test");
 const users=new Map<string,User>(),sessions=new Map<string,string>(),mail=new Map<string,{code?:string;token?:string;redirectTo?:string;userId?:string}>();
 const recovery=new Map<string,string>();
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'),kid='fixture-key';
 const mount=process.env.TEST_BASE_PATH||'';
 for(const [email,password,name,id,appId] of [['zhangkw0622@gmail.com','Admin-password-2026','Admin','neon-admin',adminId],['member@example.test','Member-password-2026','Member','neon-member',memberId]]) {
   users.set(email,{id,email,password,name,emailVerified:true});await db.query('insert into private.auth_identities(neon_user_id,user_id) values($1,$2)',[id,appId]);
 }
 // Additional unlinked imported accounts exercise reconnection and suspension.
 await db.query(`insert into public.app_accounts(user_id,email,role,status,verified_at,legacy) values
  ('33333333-3333-4333-8333-333333333333','legacy-admin@example.test','admin','active',now(),true),
  ('44444444-4444-4444-8444-444444444444','legacy-suspended@example.test','member','suspended',now(),true)`);
 async function webhook(type:string,user:User,userAgent:unknown) {
  const raw=JSON.stringify({event_id:randomUUID(),event_type:type,context:{endpoint_id:'127'},user:{...(type==='user.created'?{id:user.id}:{}),email:user.email},event_data:{auth_provider:'credential',user_agent:userAgent}});
  const timestamp=String(Date.now()),header=Buffer.from(JSON.stringify({alg:'EdDSA',kid})).toString('base64url');
  const payload=Buffer.from(`${timestamp}.${Buffer.from(raw).toString('base64url')}`).toString('base64url');
  const signature=sign(null,Buffer.from(`${header}.${payload}`),privateKey).toString('base64url');
  return fetch(`http://127.0.0.1:3102${mount}/api/auth/neon-webhook`,{method:'POST',headers:{'content-type':'application/json','x-neon-signature':`${header}..${signature}`,'x-neon-signature-kid':kid,'x-neon-timestamp':timestamp,'x-neon-event-type':type,'x-neon-event-id':JSON.parse(raw).event_id},body:raw});
 }
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://127.0.0.1:54329'),path=url.pathname;
  const reply=(data:unknown,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  const fail=(code:string,status=400)=>reply({code,message:code},status);
  const token=/(?:^|;\s*)__Secure-neon-auth\.session_token=([^;]+)/.exec(req.headers.cookie||'')?.[1];
  const signedEmail=token?sessions.get(token):undefined,user=signedEmail?users.get(signedEmail):undefined;
  const publicUser=(u:User)=>({id:u.id,email:u.email,name:u.name,emailVerified:u.emailVerified,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  const sessionData=(u:User,t:string)=>({user:publicUser(u),session:{id:t,token:t,userId:u.id,expiresAt:new Date(Date.now()+86400000).toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}});
  try {
   if(path==='/health')return reply({ok:true});
   if(path==='/auth/.well-known/jwks.json')return reply({keys:[{...publicKey.export({format:'jwk'}),kid}]});
   if(path==='/__test/mailbox') {
    const email=url.searchParams.get('email')!,record=mail.get(email);const account=(await db.query('select user_id from public.app_accounts where email=$1',[email])).rows[0];
    return reply({...record,userId:account?.user_id,registered:users.has(email)});
   }
   if(path==='/auth/get-session')return reply(user&&token?sessionData(user,token):null);
   let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
   const email=String(body.email||'').trim().toLowerCase(),existing=users.get(email);
   if(path==='/auth/sign-up/email') {
    if(existing)return fail('USER_ALREADY_EXISTS');
    const candidate={id:randomUUID(),email,name:body.name,emailVerified:false,password:body.password};
    const userAgent=email==='masked-rejection@example.test'?undefined:req.headers['user-agent'];
    const before=await webhook('user.before_create',candidate,userAgent);
    // Live Neon masks rejected signup with a fake user to prevent enumeration.
    if(!before.ok || !(await before.json()).allowed)return reply({user:publicUser(candidate),token:null});
    users.set(email,candidate);mail.set(email,{code:'123456'});
    await webhook('user.created',candidate,userAgent);
    return reply({user:publicUser(candidate),token:null});
   }
   if(path==='/auth/sign-in/email') {
    if(!existing||existing.password!==body.password)return fail('INVALID_EMAIL_OR_PASSWORD',401);
    if(!existing.emailVerified)return fail('EMAIL_NOT_VERIFIED',403);
    const next=randomUUID();sessions.set(next,email);res.setHeader('set-cookie',`__Secure-neon-auth.session_token=${next}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    return reply({token:next,user:publicUser(existing)});
   }
   if(path==='/auth/email-otp/send-verification-otp') {if(existing)mail.set(email,{code:'123456'});return reply({success:true});}
   if(path==='/auth/email-otp/verify-email') {
    if(!existing||mail.get(email)?.code!==body.otp)return fail('INVALID_OTP');
    existing.emailVerified=true;mail.delete(email);return reply({status:true,user:publicUser(existing)});
   }
   if(path==='/auth/request-password-reset') {
    if(existing){const reset=randomUUID();recovery.set(reset,email);mail.set(email,{token:reset,redirectTo:body.redirectTo});}
    return reply({status:true});
   }
   if(path==='/auth/reset-password') {
    const target=recovery.get(body.token);if(!target)return fail('INVALID_TOKEN');
    users.get(target)!.password=body.newPassword;recovery.delete(body.token);
    for(const [id,owner]of sessions)if(owner===target)sessions.delete(id);
    return reply({status:true});
   }
   if(path==='/auth/sign-out') {
    if(token)sessions.delete(token);res.setHeader('set-cookie','__Secure-neon-auth.session_token=; Path=/; HttpOnly; Secure; Max-Age=0');return reply({success:true});
   }
   return fail('NOT_FOUND',404);
  }catch(e){console.error((e as Error).message);return fail('FIXTURE_ERROR',500);}
 });
 server.listen(54329,'127.0.0.1');
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;server.close();await db.end();await pg.stop();process.exit(0);};
 process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
 console.log('Neon Auth fixture and isolated PostgreSQL ready.');
}
void main().catch(e=>{console.error(e.message);process.exitCode=1});
