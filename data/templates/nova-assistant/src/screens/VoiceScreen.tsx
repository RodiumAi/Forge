import "../styles/voice.css";
import { Captions, ChevronDown, Mic, MicOff, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Orb from "../components/Orb";
import { VOICE_LINES } from "../data";

const BARS = 28;

/** Full-screen voice mode (no tab bar): pulsing orb, live waveform, captions. */
export default function VoiceScreen() {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [line, setLine] = useState(0);

  // Walk through the scripted exchange while the mic is open.
  useEffect(() => {
    if (muted) return;
    const timer = window.setInterval(() => setLine((n) => (n + 1) % VOICE_LINES.length), 3200);
    return () => window.clearInterval(timer);
  }, [muted]);

  const speaking = line >= 2;
  const state = muted ? "muted" : speaking ? "speaking" : "listening";

  function end() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  return (
    <div className={`app-shell voice-screen ${state}`}>
      <header className="voice-bar">
        <button className="icon-btn" onClick={end} aria-label="Minimize"><ChevronDown size={20} strokeWidth={1.9} aria-hidden /></button>
        <span className="v-title"><i aria-hidden /> Nova voice</span>
        <button className={captions ? "icon-btn on" : "icon-btn"} onClick={() => setCaptions((v) => !v)} aria-pressed={captions} aria-label="Captions">
          <Captions size={19} strokeWidth={1.9} aria-hidden />
        </button>
      </header>

      <div className="stage">
        <span className="pulse p1" aria-hidden />
        <span className="pulse p2" aria-hidden />
        <Orb size="xl" state={state} />
      </div>

      <p className="status">{muted ? "Microphone off" : speaking ? "Nova is speaking" : "Listening"}</p>
      <p className={captions ? "caption" : "caption hidden"} aria-live="polite">{muted ? "Tap the mic to keep talking." : VOICE_LINES[line]}</p>

      <div className="wave" aria-hidden>
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} style={{ animationDelay: `${-((i * 137) % 900) / 1000}s`, animationDuration: `${0.7 + ((i * 53) % 60) / 100}s` }} />
        ))}
      </div>

      <div className="controls">
        <button className={muted ? "ctl on" : "ctl"} onClick={() => setMuted((v) => !v)} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <MicOff size={24} strokeWidth={1.9} aria-hidden /> : <Mic size={24} strokeWidth={1.9} aria-hidden />}
        </button>
        <button className="ctl end" onClick={end} aria-label="End voice mode"><PhoneOff size={24} strokeWidth={1.9} aria-hidden /></button>
      </div>
    </div>
  );
}
