import { deleteLocalRecording, type LocalRecording } from "./local";
const inFlight=new Map<string,Promise<void>>();
export const isRecordingUploading=(owner:string,id:string)=>inFlight.has(`${owner}:${id}`);
async function responseJson(response:Response) {
  const value=await response.json();
  if(!response.ok) throw new Error(value.error || "Recording upload failed. Your local copy is saved; retry when connected.");
  return value;
}
export function uploadRecording(recording:LocalRecording,accountFetch:typeof fetch):Promise<void> {
  const key=`${recording.owner}:${recording.id}`;
  const existing=inFlight.get(key); if(existing) return existing;
  const upload=(async()=>{
    const path=`/api/interviews/${recording.sessionId}/recordings`;
    const prepared=await responseJson(await accountFetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:recording.id,mimeType:recording.mimeType,sizeBytes:recording.blob.size,durationMs:recording.durationMs})}));
    if(!prepared.ready) {
      const form=new FormData();
      for(const [key,value] of Object.entries(prepared.upload.fields)) form.append(key,value as string);
      form.append("file",recording.blob);
      const uploaded=await fetch(prepared.upload.url,{method:"POST",body:form,signal:AbortSignal.timeout(180000)});
      if(!uploaded.ok) throw new Error(recording.persisted===false?"Recording upload failed. Download this recording before leaving the page.":"Recording upload failed. Your local copy is saved; retry when connected.");
      await responseJson(await accountFetch(`${path}/${recording.id}`,{method:"POST"}));
    }
    await deleteLocalRecording(recording.owner,recording.id);
  })().finally(()=>{inFlight.delete(key);window.dispatchEvent(new Event("interview-pal-recordings-changed"));});
  inFlight.set(key,upload);return upload;
}
