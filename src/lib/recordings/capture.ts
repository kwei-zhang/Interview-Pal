import { saveRecordingChunk, type LocalRecording, type LocalRecordingMetadata } from "./local";
import { MAX_RECORDING_BYTES, type RecordingMime } from "./types";
export interface RecordingStreams {microphone?:MediaStream; interviewer?:MediaStream}
export const activeRecordingIds=new Set<string>();
export class InterviewAudioCapture {
  private context:AudioContext;
  private destination:MediaStreamAudioDestinationNode;
  private recorder:MediaRecorder;
  private sources=new Map<MediaStream,MediaStreamAudioSourceNode>();
  private chunks:Blob[]=[];
  private writes:Promise<unknown>=Promise.resolve();
  private started=0;
  private result?:Promise<LocalRecording>;
  private resolve!:(recording:LocalRecording)=>void;
  private metadata:LocalRecordingMetadata;
  private stopped=false;
  private completing=false;
  private persistenceFailed=false;
  get id() {return this.metadata.id;}
  static supported() {return typeof MediaRecorder!=="undefined" && typeof AudioContext!=="undefined";}
  constructor(owner:string,sessionId:string,private onError:(message:string)=>void,private onStop:(recording:LocalRecording)=>void) {
    if(!InterviewAudioCapture.supported()) throw new Error("Audio recording is not supported in this browser.");
    this.context=new AudioContext();this.destination=this.context.createMediaStreamDestination();
    const mime=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"].find(type=>MediaRecorder.isTypeSupported(type));
    if(!mime) {void this.context.close();throw new Error("This browser cannot save a supported audio recording. Try Chrome, Edge, or Safari.");}
    this.recorder=new MediaRecorder(this.destination.stream,{mimeType:mime,audioBitsPerSecond:64000});
    this.metadata={owner,sessionId,id:crypto.randomUUID(),mimeType:mime.split(";")[0] as RecordingMime,sizeBytes:0,durationMs:0,createdAt:new Date().toISOString(),complete:false};
    this.recorder.ondataavailable=event=>{
      if(!event.data.size) return;
      this.chunks.push(event.data);
      this.metadata={...this.metadata,sizeBytes:this.metadata.sizeBytes+event.data.size,durationMs:Math.round(performance.now()-this.started)};
      const snapshot={...this.metadata},index=this.chunks.length-1;
      this.writes=this.writes.then(()=>saveRecordingChunk(snapshot,index,event.data)).catch(()=>{this.persistenceFailed=true;this.onError("This browser could not save the recording. Stop and download it before leaving this page.");});
      if(this.metadata.sizeBytes>=MAX_RECORDING_BYTES-1024*1024) {this.onError("Recording reached its size limit and was stopped. You can start another recording.");void this.stop();}
    };
    this.recorder.onerror=()=>{this.onError("Recording stopped unexpectedly. Any captured audio is kept.");void this.stop();};
    this.recorder.onstop=()=>{void this.complete();};
  }
  async start(streams:RecordingStreams) {
    // Resume while still inside the user's click; never open an additional microphone.
    await this.context.resume();
    if(this.stopped) return;
    this.update(streams);
    this.started=performance.now();
    this.result=new Promise(resolve=>{this.resolve=resolve;});
    activeRecordingIds.add(this.id);
    try {this.recorder.start(5000);} catch(error) {activeRecordingIds.delete(this.id);this.result=undefined;this.cleanup();throw error;}
  }
  update(streams:RecordingStreams) {
    if(this.stopped) return;
    const next=[streams.microphone,streams.interviewer].filter((stream):stream is MediaStream=>Boolean(stream?.getAudioTracks().length));
    for(const [stream,node] of this.sources) if(!next.includes(stream)){node.disconnect();this.sources.delete(stream);}
    for(const stream of next) if(!this.sources.has(stream)){const node=this.context.createMediaStreamSource(stream);node.connect(this.destination);this.sources.set(stream,node);}
  }
  stop():Promise<LocalRecording|undefined> {
    if(!this.result) {this.stopped=true;this.cleanup();return Promise.resolve(undefined);}
    if(!this.stopped){this.stopped=true;if(this.recorder.state!=="inactive") this.recorder.stop();else void this.complete();}
    return this.result;
  }
  private async complete() {
    if(this.completing)return;this.completing=true;
    this.stopped=true;
    this.cleanup();
    await this.writes;
    this.metadata={...this.metadata,complete:!this.persistenceFailed};
    try {await saveRecordingChunk(this.metadata);} catch {this.persistenceFailed=true;this.onError("Your recording could not be saved on this browser. Download it before leaving.");}
    const recording={...this.metadata,complete:true,persisted:!this.persistenceFailed,blob:new Blob(this.chunks,{type:this.metadata.mimeType})};
    activeRecordingIds.delete(this.id);
    this.onStop(recording);this.resolve(recording);
  }
  private cleanup() {
    for(const source of this.sources.values()) source.disconnect();this.sources.clear();
    this.destination.stream.getTracks().forEach(track=>track.stop());
    if(this.context.state!=="closed") void this.context.close();
  }
}
