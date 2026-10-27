import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {verifyNeonWebhook,webhookAdmissionToken} from '../src/lib/server/neon-webhook';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const kid='test-key',now=Date.now(),baseUrl='https://ep-example.neonauth.example/neondb/auth';
const options={keys:[{...publicKey.export({format:'jwk'}),kid}],now,baseUrl};
function message(overrides:Record<string,unknown>={}) {
  const payload={event_id:randomUUID(),event_type:'user.before_create',context:{endpoint_id:'ep-example'},user:{id:'identity',email:'member@example.test'},event_data:{auth_provider:'credential',user_agent:`InterviewPal-Admission/1 ${'a'.repeat(64)}`},...overrides};
  const raw=JSON.stringify(payload),header=Buffer.from(JSON.stringify({alg:'EdDSA',kid})).toString('base64url');
  const value=Buffer.from(`${now}.${Buffer.from(raw).toString('base64url')}`).toString('base64url');
  const signature=sign(null,Buffer.from(`${header}.${value}`),privateKey).toString('base64url');
  const headers=new Headers({'x-neon-signature':`${header}..${signature}`,'x-neon-signature-kid':kid,'x-neon-timestamp':String(now),'x-neon-event-id':payload.event_id,'x-neon-event-type':String(payload.event_type)});
  return {raw,headers};
}
test('Signed Neon events require exact raw bytes, trusted key, fresh time and endpoint binding',async()=>{
  const {raw,headers}=message();assert.equal((await verifyNeonWebhook(raw,headers,options)).user.id,'identity');
  await assert.rejects(verifyNeonWebhook(raw+' ',headers,options),/Invalid webhook signature/);
  await assert.rejects(verifyNeonWebhook(raw,headers,{...options,now:now+300001}),/Invalid webhook signature/);
  await assert.rejects(verifyNeonWebhook(raw,headers,{...options,keys:[]}),/Invalid webhook signature/);
  for(const [key,value] of [['x-neon-signature','invalid..invalid'],['x-neon-signature-kid','other'],['x-neon-timestamp','yesterday'],['x-neon-event-id',randomUUID()],['x-neon-event-type','user.created']]) {
    const changed=new Headers(headers);changed.set(key,value);await assert.rejects(verifyNeonWebhook(raw,changed,options));
  }
  const wrong=message({context:{endpoint_id:'ep-attacker'}});await assert.rejects(verifyNeonWebhook(wrong.raw,wrong.headers,options));
});

test('Live before-create shape permits an absent ID; created events require it',async()=>{
  const before=message({user:{email:'member@example.test'}});
  assert.equal((await verifyNeonWebhook(before.raw,before.headers,options)).event_type,'user.before_create');
  const created=message({event_type:'user.created',user:{email:'member@example.test'}});
  await assert.rejects(verifyNeonWebhook(created.raw,created.headers,options),/Invalid webhook signature/);
});

test('Admission transport accepts only the exact server marker in signed request metadata',async()=>{
  const {raw,headers}=message();
  const event=await verifyNeonWebhook(raw,headers,options);
  assert.equal(webhookAdmissionToken(event.event_data.user_agent),'a'.repeat(64));
  for(const value of [undefined,'Mozilla/5.0','InterviewPal-Admission/1 short',`prefix InterviewPal-Admission/1 ${'a'.repeat(64)}`,`InterviewPal-Admission/1 ${'a'.repeat(64)} suffix`])assert.equal(webhookAdmissionToken(value),undefined);
});
