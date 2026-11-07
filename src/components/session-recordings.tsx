"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Circle, Download, Play, Square, Trash2, Upload } from "lucide-react";
import type { VoiceTransport } from "@/lib/interview/agent";
import { InterviewAudioCapture, activeRecordingIds, type RecordingStreams } from "@/lib/recordings/capture";
import { deleteLocalRecording, listLocalRecordings, type LocalRecording } from "@/lib/recordings/local";
import { recordingFilename, type RecordingInfo } from "@/lib/recordings/types";
import { isRecordingUploading, uploadRecording } from "@/lib/recordings/upload";
import { useWorkspace } from "./workspace-provider";
import styles from "./session-recordings.module.css";

export interface SessionRecordingHandle {stop:()=>Promise<void>}
function LocalAudio({blob}: {blob:Blob}) {
  const [url,setUrl]=useState("");
  useEffect(()=>{const url=URL.createObjectURL(blob);setUrl(url);return()=>URL.revokeObjectURL(url);},[blob]);
  return url ? <audio controls preload="metadata" src={url} aria-label="Local interview recording"/> : null;
}
export function SessionRecordings({sessionId,voice,live=false,ref}: {sessionId:string;voice?:VoiceTransport;live?:boolean;ref?:Ref<SessionRecordingHandle>}) {
  const {mode,userId,accountFetch}=useWorkspace();
  const owner=mode==="cloud" ? userId! : "local-demo";
  const [local,setLocal]=useState<LocalRecording[]>([]);
  const [cloud,setCloud]=useState<RecordingInfo[]>([]);
  const [error,setError]=useState("");
  const [recording,setRecording]=useState(false);
  const [starting,setStarting]=useState(false);
  const [saving,setSaving]=useState(false);
  const [busy,setBusy]=useState("");
  const [deleting,setDeleting]=useState("");
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [playback,setPlayback]=useState<{id:string;url:string}|null>(null);
  const capture=useRef<InterviewAudioCapture|null>(null);
  const streams=useRef<RecordingStreams>({});
  const mounted=useRef(true);
  const load=useCallback(async()=>{
    try {
      const records=await listLocalRecordings(owner,sessionId);
      if(mounted.current) {setLocal(previous=>[...records.filter(value=>value.blob.size>0 && !activeRecordingIds.has(value.id) && !previous.some(old=>old.id===value.id&&old.persisted===false)),...previous.filter(value=>value.persisted===false)]);setBusy(records.find(value=>isRecordingUploading(owner,value.id))?.id || "");}
      if(mode==="cloud") {
        const response=await accountFetch(`/api/interviews/${sessionId}/recordings`); const body=await response.json();
        if(!response.ok) throw new Error(body.error || "Could not load saved recordings.");
        if(mounted.current){setCloud(body.recordings);setConfigured(body.configured);}
      }
    } catch(error) {if(mounted.current)setError(error instanceof Error?error.message:"Could not load saved recordings.");}
  },[owner,sessionId,mode,accountFetch]);
  const upload=useCallback(async(value:LocalRecording)=>{
    if(mounted.current){setBusy(value.id);setError("");}
    try {await uploadRecording(value,accountFetch);if(mounted.current)setLocal(previous=>previous.filter(row=>row.id!==value.id));await load();}
    catch(error){if(mounted.current)setError(error instanceof Error?error.message:"Upload failed. Your local recording is kept.");}
    finally{if(mounted.current)setBusy("");}
  },[accountFetch,load]);
  const uploadRef=useRef(upload);uploadRef.current=upload;
  const stop=useCallback(async()=>{
    const current=capture.current;
    if(!current)return;
    if(mounted.current)setSaving(true);
    await current.stop();
    if(capture.current===current)capture.current=null;
    if(mounted.current){setRecording(false);setSaving(false);}
  },[]);
  useImperativeHandle(ref,()=>({stop}),[stop]);
  useEffect(()=>{
    mounted.current=true;void load();
    const changed=()=>{void load();};window.addEventListener("interview-pal-recordings-changed",changed);
    return()=>{mounted.current=false;window.removeEventListener("interview-pal-recordings-changed",changed);void capture.current?.stop();};
  },[load]);
  useEffect(()=>voice?.subscribeAudioStreams?.(next=>{
    streams.current=next;
    if(!next.microphone){void stop();return;}
    capture.current?.update(next);
  }),[voice,stop]);
  const start=async()=>{
    if(starting || capture.current || !live || !streams.current.microphone)return;
    setStarting(true);setError("");
    try {
      const current=new InterviewAudioCapture(owner,sessionId,message=>{if(mounted.current)setError(message);},value=>{
        if(capture.current?.id===value.id)capture.current=null;
        if(mounted.current){setRecording(false);setSaving(false);setLocal(previous=>[...previous.filter(row=>row.id!==value.id),value]);}
        if(mode==="cloud" && value.blob.size)void uploadRef.current(value);
      });
      capture.current=current;
      await current.start(streams.current);
      if(mounted.current)setRecording(true);
    } catch(error){await capture.current?.stop();capture.current=null;setError(error instanceof Error?error.message:"Recording could not start.");}
    finally{if(mounted.current)setStarting(false);}
  };
  const downloadLocal=(record:LocalRecording)=>{
    const url=URL.createObjectURL(record.blob);const link=document.createElement("a");
    link.href=url;link.download=recordingFilename(sessionId,record.id,record.mimeType);link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
  const accessCloud=async(record:Pick<RecordingInfo,"id">,download:boolean)=>{
    setBusy(record.id);setError("");
    try {
      const response=await accountFetch(`/api/interviews/${sessionId}/recordings/${record.id}${download?"?download=true":""}`);const body=await response.json();
      if(!response.ok)throw new Error(body.error || "Could not open this recording.");
      if(download){const link=document.createElement("a");link.href=body.url;link.click();}
      else setPlayback({id:record.id,url:body.url});
    }catch(error){setError(error instanceof Error?error.message:"Could not open this recording.");}finally{setBusy("");}
  };
  const remove=async(id:string,isCloud:boolean)=>{
    setBusy(id);setError("");
    try {
      if(isCloud){const response=await accountFetch(`/api/interviews/${sessionId}/recordings/${id}`,{method:"DELETE"});if(!response.ok)throw new Error((await response.json()).error || "Recording could not be deleted.");}
      await deleteLocalRecording(owner,id);setLocal(previous=>previous.filter(row=>row.id!==id));setCloud(previous=>previous.filter(row=>row.id!==id));setDeleting("");
      if(playback?.id===id)setPlayback(null);
    }catch(error){setError(error instanceof Error?error.message:"Recording could not be deleted.");}finally{setBusy("");}
  };
  const rows=[...cloud.filter(row=>row.status==="ready" && !local.some(value=>value.id===row.id)),...local].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  return <section className={`card ${styles.panel}`} aria-label="Session recordings">
    <div className={styles.heading}><h3>Session recording</h3>{voice && <button type="button" className={`button ${recording?"button-secondary":"button-primary"} button-small`} disabled={starting||saving||(!recording&&!live)} onClick={()=>void(recording?stop():start())}>{recording?<Square size={12}/>:<Circle size={12}/>} {saving?"Saving recording…":starting?"Starting…":recording?"Stop recording":"Record interview"}</button>}</div>
    {recording && <p className={styles.active} role="status"><span/>Recording your microphone and interviewer audio</p>}
    <p className="field-hint">{mode==="cloud"?"Recordings upload privately to your account after stopping. Keep this page open until upload finishes. Your browser keeps a temporary copy for retries.":"Local preview: recordings stay in this browser and can be downloaded. Sign in to a connected workspace for long-term cloud storage."}</p>
    {voice&&!live&&!recording && <p className="field-hint">Connect live voice to record both sides of the interview.</p>}
    {mode==="cloud" && configured===false && <p className="inline-alert">Cloud recording storage is not connected yet. Download your local copies or retry uploading after setup.</p>}
    {rows.length>0 && <ul className={styles.list}>{rows.map((row,index)=>{
      const localRow="blob" in row?row:undefined;
      return <li key={row.id}><div className={styles.heading}><div><strong>Recording {index+1}</strong><p className="field-hint">{Math.floor(row.durationMs/60000)}m {Math.floor(row.durationMs/1000)%60}s · {(row.sizeBytes/1024/1024).toFixed(1)} MB · {localRow?(localRow.persisted===false?"Not saved — download before leaving":localRow.complete?"Saved on this browser":"Recovered partial recording"):"Saved to your account"}</p></div><div className="button-row">
        {!localRow && <button className="button button-secondary button-small" disabled={Boolean(busy)} onClick={()=>void accessCloud(row,false)}><Play size={12}/>Play</button>}
        <button className="button button-secondary button-small" disabled={Boolean(busy)} onClick={()=>localRow?downloadLocal(localRow):void accessCloud(row,true)}><Download size={12}/>Download recording</button>
        {localRow&&mode==="cloud"&&<button className="button button-secondary button-small" disabled={Boolean(busy)} onClick={()=>void upload(localRow)}><Upload size={12}/>{busy===row.id?"Uploading…":"Upload to account"}</button>}
        <button className="icon-button" aria-label={`Delete recording ${index+1}`} disabled={Boolean(busy)} onClick={()=>setDeleting(row.id)}><Trash2 size={13}/></button>
      </div></div>
      {localRow?<LocalAudio blob={localRow.blob}/>:playback?.id===row.id?<audio controls autoPlay src={playback.url} aria-label={`Interview recording ${index+1}`}/>:null}
      {deleting===row.id&&<div className={styles.confirm}><span>Delete this recording permanently?</span><button className="button button-secondary button-small" disabled={Boolean(busy)} onClick={()=>void remove(row.id,!localRow||cloud.some(value=>value.id===row.id))}>Confirm delete</button><button className="text-link" onClick={()=>setDeleting("")}>Cancel</button></div>}
      </li>;
    })}</ul>}
    {!recording&&!rows.length&&<p className="field-hint">No recordings saved for this session.</p>}
    {error&&<p className="inline-alert" role="alert">{error}</p>}
  </section>;
}
