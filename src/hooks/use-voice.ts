import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom by default in all TS libs).
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};
type SpeechRecognitionErrorEvent = { error: string; message?: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface VoiceOptions {
  lang?: string;
  continuous?: boolean;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
}

export function useVoice(opts: VoiceOptions = {}) {
  const { lang = "en-US", continuous = false, onFinal, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported] = useState<boolean>(() => isVoiceSupported());
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalCbRef = useRef(onFinal);
  const interimCbRef = useRef(onInterim);
  finalCbRef.current = onFinal;
  interimCbRef.current = onInterim;

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recRef.current) { try { recRef.current.abort(); } catch { /* noop */ } }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      if (interim) {
        setTranscript(interim);
        interimCbRef.current?.(interim.trim());
      }
      if (finalText) {
        setTranscript(finalText);
        finalCbRef.current?.(finalText.trim());
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, continuous]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, transcript, start, stop, toggle };
}
