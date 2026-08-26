/**
 * Server-sent events reader for the agent stream.
 *
 * Extracted from the builder page so it can be tested on its own. The previous
 * inline version only understood single-line `data: ` frames: it dropped
 * `event:` / `id:` / `retry:` fields, ignored multi-line data (which the spec
 * requires to be joined with newlines), and silently swallowed malformed JSON
 * with no way for the caller to notice.
 */

export type SseFrame = {
  event?: string;
  id?: string;
  data: string;
};

/** Parse one raw `\n\n`-delimited chunk into a frame, or null if it has no data. */
export function parseSseFrame(raw: string): SseFrame | null {
  const frame: SseFrame = { data: "" };
  const dataLines: string[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue; // comment / heartbeat

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single leading space after the colon is part of the framing, not data.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") dataLines.push(value);
    else if (field === "event") frame.event = value;
    else if (field === "id") frame.id = value;
  }

  if (!dataLines.length) return null;
  frame.data = dataLines.join("\n");
  return frame;
}

export type SseHandlers = {
  onEvent: (payload: Record<string, unknown>, frame: SseFrame) => void | Promise<void>;
  /** Called for frames whose data is not valid JSON, instead of dropping them. */
  onParseError?: (raw: string, error: unknown) => void;
  /** Last received `id:`, so a reconnect can resume with Last-Event-ID. */
  onId?: (id: string) => void;
};

export async function readSseStream(res: Response, handlers: SseHandlers | SseHandlers["onEvent"]) {
  const opts: SseHandlers = typeof handlers === "function" ? { onEvent: handlers } : handlers;
  if (!res.body) throw new Error("No stream body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = async (raw: string) => {
    const frame = parseSseFrame(raw);
    if (!frame) return;
    if (frame.id) opts.onId?.(frame.id);
    if (frame.data === "[DONE]") return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(frame.data) as Record<string, unknown>;
    } catch (err) {
      opts.onParseError?.(frame.data, err);
      return;
    }
    await opts.onEvent(payload, frame);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) await flush(part);
  }

  // A stream cut without a trailing blank line still carries a final frame.
  buffer += decoder.decode();
  if (buffer.trim()) await flush(buffer);
}
