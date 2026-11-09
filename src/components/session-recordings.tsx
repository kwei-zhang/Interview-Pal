"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Download, Play, Trash2, Upload } from "lucide-react";
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
  const [retryable,setRetryable]=useState(false);
  const [busy,setBusy]=useState("");
  const [deleting,setDeleting]=useState("");
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [playback,setPlayback]=useState<{id:string;url:string}|null>(null);
  const stopCapture=useRef<()=>Promise<void>>(async()=>{});
  const retryCapture=useRef<()=>void>(()=>{});
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
  useImperativeHandle(ref,()=>({stop:()=>stopCapture.current()}),[]);
  useEffect(()=>{
    mounted.current=true;void load();
    const changed=()=>{void load();};window.addEventListener("interview-pal-recordings-changed",changed);
    return()=>{mounted.current=false;window.removeEventListener("interview-pal-recordings-changed",changed);};
  },[load]);
  useEffect(()=>{
    let active=true,finished=false,failed=false;
    let streams:RecordingStreams={};
    let current:InterviewAudioCapture|null=null;
    const stopping=new Set<string>();
    const stop=async()=>{
      const previous=current;
      if(!previous)return;
      stopping.add(previous.id);
      if(active)setSaving(true);
      await previous.stop();
      if(current===previous)current=null;
      if(active&&!current){setRecording(false);setStarting(false);setSaving(false);}
    };
    const start=async()=>{
      if(!active||finished||failed||current||!streams.microphone)return;
      setStarting(true);setRetryable(false);
      let capture:InterviewAudioCapture|undefined;
      try {
        capture=new InterviewAudioCapture(owner,sessionId,message=>{if(active)setError(message);},(value,rollover)=>{
          if(current?.id===value.id)current=null;
          if(active){setRecording(false);setSaving(false);setLocal(previous=>[...previous.filter(row=>row.id!==value.id),value]);}
          if(mode==="cloud"&&value.blob.size)void uploadRef.current(value);
          if(active&&!finished&&streams.microphone) {
            if(rollover)void start();
            else if(!stopping.has(value.id)){failed=true;setRetryable(true);}
          }
          stopping.delete(value.id);
        });
        current=capture;
        await capture.start(streams);
        // A disconnect, finish, or unmount can happen while audio is starting.
        if(active&&!finished&&current===capture)setRecording(true);
      } catch(error) {
        failed=true;
        await capture?.stop();
        if(current===capture)current=null;
        if(active){setRetryable(true);setError(error instanceof Error?error.message:"Automatic recording could not start.");}
      } finally {if(active&&(!current||current===capture))setStarting(false);}
    };
    const finish=async()=>{finished=true;setRetryable(false);await stop();};
    stopCapture.current=finish;
    retryCapture.current=()=>{failed=false;setError("");void start();};
    const unsubscribe=voice?.subscribeAudioStreams?.(next=>{
      const reconnect=next.microphone!==streams.microphone;
      streams=next;
      if(!next.microphone){void stop().then(()=>{if(!failed)void start();});return;}
      if(reconnect)failed=false;
      current?.update(next);
      void start();
    });
    return()=>{
      active=false;finished=true;unsubscribe?.();void stop();
      if(stopCapture.current===finish)stopCapture.current=async()=>{};
      retryCapture.current=()=>{};
    };
  },[voice,owner,sessionId,mode]);
  const downloadLocal=(record:LocalRecording)=>{
    const url=URL.createObjectURL(record.blob);const link=document.createElement("a");
    link.href=url;link.download=recordingFilename(sessionId,record.id,record.mimeType);link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
  const accessCloud=async(record:Pick<RecordingInfo,"id">,download:boolean)=>{
    setBusy(record.id);setError("");
    try {
      const response=await accountFetch(`/api/interviews/${sessionId}/recordings/${record.id}${download?"?download=true":""}`);const body=await response.json();
      if(!response.ok)throw new Error(body.error || "Could not open this recording.");
      if(download){const link=document.createElement("a");link.href=body.url;link.download="";link.click();}
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
    <div className={styles.heading}><h3>Session recording</h3>{voice&&<span className="field-hint">Automatic recording · always on</span>}</div>
    {recording && <p className={styles.active} role="status"><span/>Recording your microphone and interviewer audio</p>}
    {starting&&<p className="field-hint" role="status">Starting automatic recording… If your browser pauses audio, click anywhere in the room to continue.</p>}
    {saving&&<p className="field-hint" role="status">Saving recording…</p>}
    <p className="field-hint">{mode==="cloud"?"Recordings upload privately to your account when the session ends or voice disconnects. Keep this page open until upload finishes. Your browser keeps a temporary copy for retries.":"Local preview: recordings stay in this browser and can be downloaded. Sign in to a connected workspace for long-term cloud storage."}</p>
    {voice&&!live&&!recording&&!starting && <p className="field-hint">Recording starts automatically when your microphone connects. It cannot be turned off during a voice interview.</p>}
    {retryable&&voice&&live&&!starting&&!recording&&<button type="button" className="button button-secondary button-small" onClick={()=>retryCapture.current()}>Retry automatic recording</button>}
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
