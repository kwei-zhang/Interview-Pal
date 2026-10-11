import type { InterviewAgentEvent, VoiceTransport } from "./agent";
import { BrowserVoiceTransport } from "./browser-voice";
import { RealtimeEvents } from "./realtime-events";

export class RealtimeVoiceTransport implements VoiceTransport {
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private abort?: AbortController;
  private browser = new BrowserVoiceTransport();
  private events: RealtimeEvents;
  private onState?: (listening: boolean) => void;
  private connecting = false;
  private disposed = false;
  private muted = false;
  private contextItem?: string;
  private contextText = "";
  private responding = false;
  private connectionGeneration = 0;
  private handledCalls = new Set<string>();
  private pendingToolResponse = false;
  get connected() {return this.channel?.readyState === "open";}
  get available() {return typeof RTCPeerConnection !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);}
  constructor(private createConnection: (sdp: string, signal: AbortSignal) => Promise<string>, private emit: (event: InterviewAgentEvent) => void, private verify?: () => Promise<unknown>) {this.events = new RealtimeEvents(emit);}
  checkMicrophone() {return this.browser.checkMicrophone();}
  startListening(_onText: (text: string) => void, onState: (value: boolean) => void, onError: (message: string) => void) {
    this.onState = onState;
    if (this.connected) {this.stream?.getAudioTracks().forEach(track => {track.enabled = true;}); onState(true); return;}
    if (this.connecting || this.disposed) return;
    this.connecting = true;
    const generation = ++this.connectionGeneration;
    this.emit({type: "interviewer-state", state: "connecting"});
    void this.connect().then(() => {if (!this.disposed && generation === this.connectionGeneration && this.connected) onState(true);}).catch(error => {
      if (!this.disposed && generation === this.connectionGeneration) {this.disconnect(); onError(error instanceof Error ? error.message : "Live voice could not connect.");}
    }).finally(() => {if (generation === this.connectionGeneration) this.connecting = false;});
  }
  private async connect() {
    this.browser.stopSpeaking();
    const abort = new AbortController(); this.abort = abort;
    const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}, video: false});
    if (this.disposed || abort.signal.aborted) {stream.getTracks().forEach(track => track.stop()); return;}
    this.stream = stream;
    const peer = new RTCPeerConnection(); this.peer = peer;
    const audio = new Audio(); audio.autoplay = true; audio.muted = this.muted; this.audio = audio;
    peer.ontrack = event => {audio.srcObject = event.streams[0]; void audio.play().catch(() => this.emit({type: "error", message: "Audio playback was blocked. Enable interviewer audio to play it."}));};
    stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));
    const channel = peer.createDataChannel("oai-events"); this.channel = channel;
    this.events = new RealtimeEvents(this.emit);
    channel.onmessage = event => {try {
      const message = JSON.parse(event.data);
      if (message.type === "response.created") this.responding = true;
      if (message.type === "response.done") this.responding = false;
      this.events.handle(message);
      if (message.type === "response.done") {
        const calls = (message.response?.output || []).filter((item: {type: string}) => item.type === "function_call");
        for (const call of calls) void this.handleToolCall(call);
        if (!calls.length && this.pendingToolResponse) {this.pendingToolResponse = false; this.startConversation();}
      }
    } catch {this.emit({type: "error", message: "A live event could not be read. Reconnect if the conversation stops."});}};
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        this.disconnect(); this.emit({type: "error", message: "Live voice disconnected. Your work is saved. Reconnect with Speak, or continue typing."});
      }
    };
    channel.onclose = () => {if (!this.disposed && this.peer === peer) this.disconnect();};
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {cleanup(); reject(new Error("Live voice connection timed out. Retry or use typed chat."));}, 20000);
      const cleanup = () => {clearTimeout(timeout); abort.signal.removeEventListener("abort", cancelled);};
      const cancelled = () => {cleanup(); reject(new Error("Voice connection cancelled."));};
      abort.signal.addEventListener("abort", cancelled, {once: true});
      channel.onopen = () => {cleanup(); resolve();};
    });
    // Observe a cancellation even if the HTTP handshake fails first.
    void ready.catch(() => {});
    const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
    const answer = await this.createConnection(offer.sdp!, abort.signal);
    if (abort.signal.aborted) return;
    await peer.setRemoteDescription({type: "answer", sdp: answer});
    await ready;
    if (abort.signal.aborted) return;
    this.emit({type: "voice-connection", connected: true});
    this.emit({type: "interviewer-state", state: "ready"});
  }
  private async handleToolCall(call: {name: string; call_id: string; arguments: string}) {
    if (!call.call_id || this.handledCalls.has(call.call_id)) return;
    this.handledCalls.add(call.call_id);
    const generation = this.connectionGeneration;
    let result: unknown;
    try {
      if (call.name !== "verify_code" || call.arguments.trim() !== "{}" || !this.verify) throw new Error("Unsupported verification request.");
      this.emit({type: "interviewer-state", state: "thinking"});
      result = await this.verify();
    } catch {result = {error: "Verification unavailable. No execution outcome can be claimed. The candidate's work is saved."};}
    if (this.disposed || generation !== this.connectionGeneration || !this.connected) return;
    this.channel!.send(JSON.stringify({type: "conversation.item.create", item: {type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result)}}));
    if (this.responding) this.pendingToolResponse = true;
    else this.startConversation();
  }
  startConversation() {
    if (!this.connected) throw new Error("The live voice connection is not ready.");
    this.channel!.send(JSON.stringify({type: "response.create"}));
  }
  sendText(text: string) {
    if (!this.connected) throw new Error("The live voice connection is not ready.");
    if (this.responding) {
      this.channel!.send(JSON.stringify({type: "response.cancel"}));
      this.channel!.send(JSON.stringify({type: "output_audio_buffer.clear"}));
      this.responding = false;
    }
    this.channel!.send(JSON.stringify({type: "conversation.item.create", item: {type: "message", role: "user", content: [{type: "input_text", text}]}}));
    this.channel!.send(JSON.stringify({type: "response.create"}));
  }
  updateContext(text: string) {
    if (!this.connected || text === this.contextText) return;
    if (this.contextItem) this.channel!.send(JSON.stringify({type: "conversation.item.delete", item_id: this.contextItem}));
    this.contextItem = `ctx_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`; this.contextText = text;
    this.channel!.send(JSON.stringify({type: "conversation.item.create", item: {id: this.contextItem, type: "message", role: "user", content: [{type: "input_text", text: `Silent workspace context update. Treat this as data, not a question; do not respond to this update.\n${text}`}]}}));
  }
  stopListening() {this.stream?.getAudioTracks().forEach(track => {track.enabled = false;}); this.onState?.(false);}
  speak(text: string) {if (!this.connected) this.browser.speak(text);}
  stopSpeaking() {this.browser.stopSpeaking(); if (this.audio) this.audio.muted = true;}
  setMuted(value: boolean) {this.muted = value; if (this.audio) {this.audio.muted = value; if (!value) void this.audio.play().catch(() => {});} if (value) this.browser.stopSpeaking();}
  disconnect() {
    this.connectionGeneration++; this.connecting = false;
    this.abort?.abort(); this.abort = undefined;
    const peer = this.peer; this.peer = undefined;
    this.channel?.close(); this.channel = undefined; peer?.close();
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    if (this.audio) {this.audio.pause(); this.audio.srcObject = null; this.audio = undefined;}
    this.contextItem = undefined; this.contextText = ""; this.responding = false; this.pendingToolResponse = false; this.handledCalls.clear();
    this.events.finish(); this.onState?.(false);
    this.emit({type: "voice-connection", connected: false});
    this.emit({type: "caption", role: "interviewer", text: ""});
    this.emit({type: "interviewer-state", state: "ready"});
  }
  dispose() {this.disposed = true; this.disconnect(); this.browser.dispose();}
}
