"use client";

/**
 * The microphone of the prompt boxes (landing, overview, builder chat): a mic
 * button, then while listening a strip with live bars, the time, Cancel and
 * Done. The words appear in the field as they are recognised (see
 * lib/speech-input). Hidden where the browser has no speech recognition.
 */

import { cx } from "@/components/ui/cx";
import { Glyph } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { SPEECH_MAX_SECONDS, type SpeechInput, type SpeechInputError } from "@/lib/speech-input";

const ERROR_KEY = {
  denied: "uiVoiceErrDenied",
  "no-mic": "uiVoiceErrNoMic",
  "no-speech": "uiVoiceErrNoSpeech",
  network: "uiVoiceErrNetwork",
  failed: "uiVoiceErrFailed",
} as const satisfies Record<SpeechInputError, string>;

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceButton({
  voice,
  disabled,
  className,
  size,
}: {
  voice: SpeechInput;
  disabled?: boolean;
  /** The bar's own button class (`f-c-btn is-icon`, `f-bd-cbtn icon`). */
  className: string;
  size?: "sm";
}) {
  const { t } = useI18n();
  if (!voice.supported) return null;
  const label = voice.listening ? t("uiVoiceStop") : t("uiVoiceStart");
  return (
    <button
      type="button"
      className={cx(className, "f-voice-btn", voice.listening && "is-listening")}
      aria-label={label}
      aria-pressed={voice.listening}
      title={voice.listening ? label : t("uiVoiceStartHint")}
      disabled={disabled && !voice.listening}
      onClick={() => {
        voice.clearError();
        voice.toggle();
      }}
    >
      <Glyph name="mic" size={size} />
    </button>
  );
}

/** The listening strip, or the reason it stopped; nothing otherwise. */
export function VoiceStatus({
  voice,
  compact,
  surface,
}: {
  voice: SpeechInput;
  compact?: boolean;
  /** The strip sits on the page (light or dark theme), not inside a dark composer. */
  surface?: boolean;
}) {
  const { t } = useI18n();
  if (voice.listening) {
    const left = SPEECH_MAX_SECONDS - voice.seconds;
    return (
      <div className={cx("f-voice-strip", compact && "is-compact", surface && "is-surface")} role="status" aria-live="polite">
        <span className="f-voice-bars" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="f-voice-label">{t(compact ? "uiVoiceListeningShort" : "uiVoiceListening")}</span>
        <span className={cx("f-voice-time", left <= 15 && "is-ending")}>{clock(voice.seconds)}</span>
        <span className="f-grow" />
        <button type="button" className="f-voice-act" onClick={voice.cancel}>
          {t("uiVoiceCancel")}
        </button>
        <button type="button" className="f-voice-act is-primary" onClick={voice.stop}>
          <Glyph name="check" size="sm" /> {t("uiVoiceDone")}
        </button>
      </div>
    );
  }
  if (voice.error) {
    return (
      <div className={cx("f-voice-strip is-error", compact && "is-compact", surface && "is-surface")} role="alert">
        <Glyph name="mic" size="sm" />
        <span className="f-voice-label">{t(ERROR_KEY[voice.error])}</span>
        <span className="f-grow" />
        <button type="button" className="f-voice-act" aria-label={t("uiVoiceDismiss")} onClick={voice.clearError}>
          <Glyph name="x" size="sm" />
        </button>
      </div>
    );
  }
  return null;
}
