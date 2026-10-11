import type { VoiceTransport } from "./agent";

interface RecognitionResult {isFinal: boolean; 0: {transcript: string}}
interface RecognitionEvent {resultIndex: number; results: ArrayLike<RecognitionResult>}
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null; onstart: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionConstructor = new () => Recognition;
function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as unknown as {SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor};
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
// Browser audio helpers support microphone preflight and synthesized playback
// for typed chat. Live interviews use the Realtime WebRTC transport.
export class BrowserVoiceTransport implements VoiceTransport {
  private recognition?: Recognition;
  private stream?: MediaStream;
  get available() { return Boolean(recognitionConstructor()); }
  async checkMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs a supported browser and a secure connection.");
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
    this.stream.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }
  startListening(onText: (text: string) => void, onState: (listening: boolean) => void, onError: (message: string) => void) {
    const Constructor = recognitionConstructor();
    if (!Constructor) { onError("Voice transcription is not supported in this browser. You can type your response below."); return; }
    this.stopSpeaking();
    this.recognition?.abort();
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onstart = () => onState(true);
    recognition.onend = () => { onState(false); if (this.recognition === recognition) this.recognition = undefined; };
    recognition.onresult = event => {
      const text: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) text.push(event.results[i][0].transcript);
      if (text.length) onText(text.join(" ").trim());
    };
    recognition.onerror = event => {
      if (event.error !== "aborted" && event.error !== "no-speech") onError(event.error === "not-allowed" ? "Microphone permission was denied. Allow access or type your response." : "Voice transcription stopped. Retry or type your response.");
      onState(false);
    };
    try { recognition.start(); } catch { onError("Could not start voice transcription. Please retry."); }
  }
  stopListening() { this.recognition?.stop(); }
  speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; utterance.rate = 0.97;
    window.speechSynthesis.speak(utterance);
  }
  stopSpeaking() { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }
  dispose() { this.recognition?.abort(); this.recognition = undefined; this.stream?.getTracks().forEach(t => t.stop()); this.stopSpeaking(); }
}
