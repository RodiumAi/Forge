"use client";

/**
 * Voice prompting with the browser's own speech recognition (Web Speech API).
 *
 * Nothing goes through Forge: Chrome and Edge send the audio to Google, Safari
 * to Apple, and Firefox has no recognition at all (the mic button is hidden
 * there). The words show up in the field while the user speaks; stopping
 * keeps them, cancelling puts the text back as it was. Nothing is sent: the
 * user reads it over and sends it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** The few members of SpeechRecognition used here (lib.dom does not ship them). */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type RecognitionCtor = new () => Recognition;

/** Why listening stopped early, worded by the caller. */
export type SpeechInputError = "denied" | "no-mic" | "no-speech" | "network" | "failed";

/** Long enough for a full brief, short enough not to run forever if forgotten. */
export const SPEECH_MAX_SECONDS = 120;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return recognitionCtor() !== null;
}

/** fr -> fr-FR, en -> en-US: recognition wants a full tag. */
export function speechLang(locale: string): string {
  if (locale.includes("-")) return locale;
  return locale.startsWith("fr") ? "fr-FR" : "en-US";
}

/** `base` then `spoken`, with one space between them when both have text. */
export function joinSpoken(base: string, spoken: string): string {
  const words = spoken.trim();
  if (!words) return base;
  if (!base.trim()) return words;
  return /\s$/.test(base) ? base + words : `${base} ${words}`;
}

function mapError(code: string): SpeechInputError | null {
  if (code === "aborted") return null;
  if (code === "not-allowed" || code === "service-not-allowed") return "denied";
  if (code === "audio-capture") return "no-mic";
  if (code === "no-speech") return "no-speech";
  if (code === "network") return "network";
  return "failed";
}

type Options = {
  value: string;
  onChange: (next: string) => void;
  locale: string;
  /** Upper bound on the field, so dictation never pushes past it. */
  maxLength?: number;
  /** Where the words go in the text there before the dictation (default: after it). */
  join?: (base: string, spoken: string) => string;
};

export function useSpeechInput({ value, onChange, locale, maxLength, join }: Options) {
  // Known only in the browser: render nothing on the server, then decide.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<SpeechInputError | null>(null);

  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const cancelledRef = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const joinRef = useRef(join ?? joinSpoken);
  joinRef.current = join ?? joinSpoken;

  useEffect(() => setSupported(speechInputSupported()), []);

  const write = useCallback(
    (spoken: string) => {
      let next = joinRef.current(baseRef.current, spoken);
      if (maxLength && next.length > maxLength) next = next.slice(0, maxLength);
      onChangeRef.current(next);
    },
    [maxLength],
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recRef.current?.abort();
    onChangeRef.current(baseRef.current);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = speechLang(locale);
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = valueRef.current;
    finalRef.current = "";
    cancelledRef.current = false;

    rec.onresult = (event) => {
      if (cancelledRef.current) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current = joinSpoken(finalRef.current, text);
        else interim += text;
      }
      write(joinSpoken(finalRef.current, interim));
    };
    rec.onerror = (event) => {
      const mapped = mapError(event.error);
      if (mapped) setError(mapped);
    };
    rec.onend = () => {
      // Keep only what was recognised for sure: a half-heard last word is dropped.
      if (!cancelledRef.current) write(finalRef.current);
      recRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
    } catch {
      setError("failed");
      return;
    }
    recRef.current = rec;
    setError(null);
    setSeconds(0);
    setListening(true);
  }, [locale, write]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // The timer, and the cap that stops a forgotten microphone.
  useEffect(() => {
    if (!listening) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= SPEECH_MAX_SECONDS) recRef.current?.stop();
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [listening]);

  // Leaving the page (or the composer unmounting) frees the microphone.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      recRef.current?.abort();
    },
    [],
  );

  return {
    supported,
    listening,
    seconds,
    error,
    start,
    stop,
    cancel,
    toggle,
    clearError: () => setError(null),
  };
}

export type SpeechInput = ReturnType<typeof useSpeechInput>;
