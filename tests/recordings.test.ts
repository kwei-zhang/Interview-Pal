import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { PGlite } from "@electric-sql/pglite";
import { saveRecordingChunk, listLocalRecordings, deleteLocalRecording, deleteSessionLocalRecordings, type LocalRecordingMetadata } from "../src/lib/recordings/local";
import { prepareRecording, getRecording, listRecordings, markRecordingReady, removeRecording, recordingUploadSchema } from "../src/lib/server/recordings";
import { recordingStorageConfigured } from "../src/lib/server/recording-storage";
import { saveMutation } from "../src/lib/server/workspace";
import { setupNeon,asNeonUser,adminId,memberId } from "./helpers/neon-database";
import type { InterviewSession } from "../src/lib/types";
import { uploadRecording } from "../src/lib/recordings/upload";

function metadata():LocalRecordingMetadata {return {owner:adminId,id:crypto.randomUUID(),sessionId:crypto.randomUUID(),createdAt:new Date().toISOString(),mimeType:"audio/webm",sizeBytes:6,durationMs:2000,complete:false};}
test("Recording chunks survive a new read, keep ordering, and isolate account and session access",async()=>{
  const meta=metadata();
  await saveRecordingChunk(meta,1,new Blob(["two"]));await saveRecordingChunk(meta,0,new Blob(["one"]));
  assert.equal(await (await listLocalRecordings(meta.owner,meta.sessionId))[0].blob.text(),"onetwo");
  assert.equal((await listLocalRecordings(memberId,meta.sessionId)).length,0);
  assert.equal((await listLocalRecordings(meta.owner,crypto.randomUUID())).length,0);
  await saveRecordingChunk({...meta,complete:true});
  assert.equal((await listLocalRecordings(meta.owner,meta.sessionId))[0].complete,true);
  await deleteLocalRecording(memberId,meta.id);
  assert.equal((await listLocalRecordings(meta.owner,meta.sessionId)).length,1);
  await deleteSessionLocalRecordings(meta.owner,meta.sessionId);
  assert.equal((await listLocalRecordings(meta.owner,meta.sessionId)).length,0);
});
test("Recording metadata rejects arbitrary file types, excessive sizes, and injected owner/key fields",()=>{
  const value={id:crypto.randomUUID(),mimeType:"audio/webm",sizeBytes:1024,durationMs:1000};
  assert.ok(recordingUploadSchema.safeParse(value).success);
  for(const invalid of [{mimeType:"text/html"},{sizeBytes:0},{sizeBytes:134217729},{durationMs:-1},{objectKey:"other-account"},{userId:memberId}])assert.equal(recordingUploadSchema.safeParse({...value,...invalid}).success,false);
  assert.equal(recordingStorageConfigured({}),false);
});
test("Recording upload keeps a recoverable copy on failure and removes it only after cloud verification",async()=>{
  const target=new EventTarget();Object.assign(globalThis,{window:target});
  const original=globalThis.fetch;
  const meta={...metadata(),complete:true};await saveRecordingChunk(meta,0,new Blob(["onetwo"]));
  const record=(await listLocalRecordings(meta.owner,meta.sessionId))[0];
  let completed=false;
  const accountFetch:typeof fetch=async(_url,init)=>{
    assert.equal(init?.method,"POST");
    if(String(_url).endsWith(meta.id)){completed=true;return Response.json({ok:true});}
    assert.equal(JSON.parse(String(init?.body)).sizeBytes,6);
    return Response.json({ready:false,upload:{url:"https://storage.example.test",fields:{key:"private-key"}}});
  };
  try {
    globalThis.fetch=async()=>new Response(null,{status:503});
    await assert.rejects(uploadRecording(record,accountFetch),/local copy is saved/);
    assert.equal(completed,false);assert.equal((await listLocalRecordings(meta.owner,meta.sessionId)).length,1);
    globalThis.fetch=async(_url,init)=>{assert.equal((init?.body as FormData).get("key"),"private-key");return new Response(null,{status:204});};
    await uploadRecording(record,accountFetch);
    assert.equal(completed,true);assert.equal((await listLocalRecordings(meta.owner,meta.sessionId)).length,0);
  } finally {globalThis.fetch=original;Reflect.deleteProperty(globalThis,"window");}
});
test("Cloud recording metadata is owned, idempotent, and must be removed before its session",async()=>{
  const db=new PGlite();
  try {
    await setupNeon(db);await asNeonUser(db,adminId);
    const now=new Date().toISOString();
    const session:InterviewSession={id:crypto.randomUUID(),type:"behavioral",questionId:"team-collaboration",roleId:"software-engineer",durationMinutes:30,timed:false,language:"python",status:"active",startedAt:now,lastActiveAt:now,elapsedSeconds:0,scratchpad:"",transcript:[],adapter:"agent"};
    await saveMutation(db,adminId,{kind:"session",value:session});
    const value={id:crypto.randomUUID(),mimeType:"audio/webm" as const,sizeBytes:1024,durationMs:1000};
    const row=await prepareRecording(db,adminId,session.id,value);
    assert.equal(row.status,"pending");assert.ok(row.objectKey.startsWith(`recordings/${adminId}/${session.id}/`));
    await prepareRecording(db,adminId,session.id,value);
    assert.equal((await listRecordings(db,adminId,session.id)).length,1);
    await assert.rejects(prepareRecording(db,adminId,session.id,{...value,sizeBytes:1}),/different saved metadata/);
    await markRecordingReady(db,adminId,session.id,value.id);
    assert.equal((await getRecording(db,adminId,session.id,value.id)).status,"ready");
    await asNeonUser(db,memberId);
    await assert.rejects(getRecording(db,memberId,session.id,value.id),/not found/);
    await assert.rejects(prepareRecording(db,memberId,session.id,{...value,id:crypto.randomUUID()}),/session not found/);
    await removeRecording(db,memberId,session.id,value.id);
    await asNeonUser(db,adminId);
    assert.equal((await listRecordings(db,adminId,session.id)).length,1);
    await assert.rejects(saveMutation(db,adminId,{kind:"delete-session",id:session.id}),/foreign key constraint/);
    await removeRecording(db,adminId,session.id,value.id);
    await saveMutation(db,adminId,{kind:"delete-session",id:session.id});
  }finally{await db.close();}
});
