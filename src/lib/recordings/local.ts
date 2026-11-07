import type { RecordingInfo } from "./types";
export interface LocalRecording extends Omit<RecordingInfo,"status"> {owner:string; complete:boolean; persisted?:boolean; blob:Blob}
export type LocalRecordingMetadata=Omit<LocalRecording,"blob">;
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
  const db=await database();
  try {
    const metadata=await requestValue<LocalRecordingMetadata[]>(db.transaction("clips").objectStore("clips").index("session").getAll(IDBKeyRange.only([owner,sessionId])));
    return await Promise.all(metadata.map(async meta=>{
      const chunks=await requestValue<{index:number;blob:Blob}[]>(db.transaction("chunks").objectStore("chunks").index("clip").getAll(IDBKeyRange.only([owner,meta.id])));
      return {...meta,blob:new Blob(chunks.sort((a,b)=>a.index-b.index).map(chunk=>chunk.blob),{type:meta.mimeType})};
    }));
  } finally {db.close();}
}
export function deleteLocalRecording(owner:string,id:string) {
  return write(tx=>{
    tx.objectStore("clips").delete([owner,id]);
    const cursor=tx.objectStore("chunks").index("clip").openKeyCursor(IDBKeyRange.only([owner,id]));
    cursor.onsuccess=()=>{if(cursor.result){tx.objectStore("chunks").delete(cursor.result.primaryKey);cursor.result.continue();}};
  });
}

export async function deleteSessionLocalRecordings(owner:string,sessionId:string) {
  const db=await database();
  let clips:LocalRecordingMetadata[];
  try {clips=await requestValue(db.transaction("clips").objectStore("clips").index("session").getAll(IDBKeyRange.only([owner,sessionId])));} finally {db.close();}
  await Promise.all(clips.map(clip=>deleteLocalRecording(owner,clip.id)));
}
