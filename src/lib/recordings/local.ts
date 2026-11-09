import type { RecordingInfo } from "./types";
export interface LocalRecording extends Omit<RecordingInfo,"status"> {owner:string; complete:boolean; persisted?:boolean; blob:Blob}
export type LocalRecordingMetadata=Omit<LocalRecording,"blob">;
// Keep failed writes available across in-app navigation to the review page.
// This fallback is still lost on refresh/close and is never presented as saved.
const unsaved=new Map<string,LocalRecording>();
const recordingKey=(owner:string,id:string)=>JSON.stringify([owner,id]);
export function rememberUnsavedRecording(recording:LocalRecording) {unsaved.set(recordingKey(recording.owner,recording.id),recording);}
// Audio never enters workspace JSON, exports, or AI context.
async function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("interview-pal-recordings",1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore("clips",{keyPath:["owner","id"]}).createIndex("session",["owner","sessionId"]);
      db.createObjectStore("chunks",{keyPath:["owner","id","index"]}).createIndex("clip",["owner","id"]);
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Close other Interview Pal tabs and retry saving the recording."));
  });
}
function requestValue<T>(request:IDBRequest<T>):Promise<T> {return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function write(work:(tx:IDBTransaction)=>void) {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(["clips","chunks"],"readwrite");
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error("Recording could not be saved on this browser."));
    work(tx);
  });} finally {db.close();}
}
export function saveRecordingChunk(metadata:LocalRecordingMetadata,index?:number,blob?:Blob) {
  return write(tx=>{tx.objectStore("clips").put(metadata);if(blob && index!==undefined) tx.objectStore("chunks").put({owner:metadata.owner,id:metadata.id,index,blob});});
}
export async function listLocalRecordings(owner:string,sessionId:string):Promise<LocalRecording[]> {
  const fallback=[...unsaved.values()].filter(value=>value.owner===owner&&value.sessionId===sessionId);
  let db:IDBDatabase|undefined;
  try {
    db=await database();
    const connection=db;
    const metadata=await requestValue<LocalRecordingMetadata[]>(db.transaction("clips").objectStore("clips").index("session").getAll(IDBKeyRange.only([owner,sessionId])));
    const persisted=await Promise.all(metadata.filter(meta=>!unsaved.has(recordingKey(owner,meta.id))).map(async meta=>{
      const chunks=await requestValue<{index:number;blob:Blob}[]>(connection.transaction("chunks").objectStore("chunks").index("clip").getAll(IDBKeyRange.only([owner,meta.id])));
      return {...meta,blob:new Blob(chunks.sort((a,b)=>a.index-b.index).map(chunk=>chunk.blob),{type:meta.mimeType})};
    }));
    return [...persisted,...fallback];
  } catch(error) {if(fallback.length)return fallback;throw error;}
  finally {db?.close();}
}
export async function deleteLocalRecording(owner:string,id:string) {
  await write(tx=>{
    tx.objectStore("clips").delete([owner,id]);
    const cursor=tx.objectStore("chunks").index("clip").openKeyCursor(IDBKeyRange.only([owner,id]));
    cursor.onsuccess=()=>{if(cursor.result){tx.objectStore("chunks").delete(cursor.result.primaryKey);cursor.result.continue();}};
  });
  unsaved.delete(recordingKey(owner,id));
}

export async function deleteSessionLocalRecordings(owner:string,sessionId:string) {
  const db=await database();
  let clips:LocalRecordingMetadata[];
  try {clips=await requestValue(db.transaction("clips").objectStore("clips").index("session").getAll(IDBKeyRange.only([owner,sessionId])));} finally {db.close();}
  const ids=new Set([...clips.map(clip=>clip.id),...[...unsaved.values()].filter(clip=>clip.owner===owner&&clip.sessionId===sessionId).map(clip=>clip.id)]);
  await Promise.all([...ids].map(id=>deleteLocalRecording(owner,id)));
}
