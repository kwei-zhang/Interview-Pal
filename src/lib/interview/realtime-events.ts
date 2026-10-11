import type { InterviewAgentEvent } from "./agent";

// Input transcription can finish after the model's answer. Reserve positions
// when items are created and release complete turns in conversation order.
export class RealtimeEvents {
  private items = new Map<string, {role: "candidate" | "interviewer"; text: string; done: boolean}>();
  private delivered = new Set<string>();
  constructor(private emit: (event: InterviewAgentEvent) => void) {}
  private reserve(id: string, role: "candidate" | "interviewer") {
    if (!this.delivered.has(id) && !this.items.has(id)) this.items.set(id, {role, text: "", done: false});
  }
  private flush() {
    for (const [id, item] of this.items) {
      if (!item.done) break;
      this.items.delete(id); this.delivered.add(id);
      if (item.text.trim()) this.emit({type: "transcript", event: {id: crypto.randomUUID(), role: item.role, text: item.text.trim().slice(0, 10000), timestamp: new Date().toISOString()}});
    }
  }
  handle(event: Record<string, unknown>) {
    const type = event.type;
    const item = event.item as {id?: string; role?: string; content?: {text?: string; transcript?: string}[]} | undefined;
    const id = typeof event.item_id === "string" ? event.item_id : item?.id;
    if (type === "input_audio_buffer.speech_started") this.emit({type: "interviewer-state", state: "listening"});
    if (type === "input_audio_buffer.speech_stopped" || type === "response.created") this.emit({type: "interviewer-state", state: "thinking"});
    if (id && type === "input_audio_buffer.committed") this.reserve(id, "candidate");
    if (id && (type === "conversation.item.added" || type === "response.output_item.added") && item?.role === "assistant") this.reserve(id, "interviewer");
    if (id && type === "conversation.item.input_audio_transcription.completed") {
      this.reserve(id, "candidate");
      const target = this.items.get(id);
      if (target) {target.text = typeof event.transcript === "string" ? event.transcript : "[Voice response was not transcribed]"; target.done = true;}
      this.emit({type: "caption", role: "candidate", text: ""});
    }
    if (id && type === "conversation.item.input_audio_transcription.failed") {
      this.reserve(id, "candidate"); const target = this.items.get(id);
      if (target) {target.text = "[Voice response could not be transcribed]"; target.done = true;}
      this.emit({type: "error", message: "A voice response could not be transcribed. Ask the interviewer to repeat or clarify if needed."});
    }
    if (id && (type === "response.output_audio_transcript.delta" || type === "response.output_text.delta")) {
      this.reserve(id, "interviewer"); const target = this.items.get(id);
      if (target && typeof event.delta === "string") {
        target.text = (target.text + event.delta).slice(0, 10000);
        this.emit({type: "caption", role: "interviewer", text: target.text});
      }
      this.emit({type: "interviewer-state", state: "speaking"});
    }
    if (id && (type === "response.output_audio_transcript.done" || type === "response.output_text.done" || type === "response.output_item.done")) {
      this.reserve(id, "interviewer"); const target = this.items.get(id);
      if (target) {
        const text = event.transcript ?? event.text ?? item?.content?.map(part => part.transcript || part.text || "").join("\n");
        if (typeof text === "string" && text) target.text = text;
        target.done = true;
      }
      this.emit({type: "caption", role: "interviewer", text: ""});
    }
    if (type === "response.done") {
      // Also save any partial answer on interruption; providers need not emit
      // transcript.done for a cancelled response.
      const response = event.response as {status?: string; output?: {id: string; role: string; content?: {text?: string; transcript?: string}[]}[]} | undefined;
      for (const output of response?.output || []) if (output.role === "assistant") {
        this.reserve(output.id, "interviewer"); const target = this.items.get(output.id);
        if (target) {target.text = output.content?.map(part => part.transcript || part.text || "").join("\n") || target.text; target.done = true;}
      }
      this.emit({type: "interviewer-state", state: "ready"});
      if (response?.status === "failed") this.emit({type: "error", message: "The live interviewer could not answer. Please retry your question."});
    }
    if (type === "error") this.emit({type: "error", message: "The live interviewer reported a connection error. Your transcript is saved; reconnect or use typed chat."});
    this.flush();
  }
  finish() {
    for (const item of this.items.values()) {if (!item.text && item.role === "candidate") item.text = "[Voice response was not transcribed before disconnecting]"; item.done = true;}
    this.flush();
  }
}
