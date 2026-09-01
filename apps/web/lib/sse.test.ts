import { describe, expect, it, vi } from "vitest";
import { parseSseFrame, readSseStream } from "./sse";

/** Build a Response whose body yields the given chunks, to exercise splitting. */
function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body);
}

async function collect(chunks: string[]) {
  const events: Record<string, unknown>[] = [];
  const parseErrors: string[] = [];
  const ids: string[] = [];
  await readSseStream(streamOf(chunks), {
    onEvent: (p) => {
      events.push(p);
    },
    onParseError: (raw) => {
      parseErrors.push(raw);
    },
    onId: (id) => {
      ids.push(id);
    },
  });
  return { events, parseErrors, ids };
}

describe("parseSseFrame", () => {
  it("reads a simple data frame", () => {
    expect(parseSseFrame('data: {"type":"token"}')).toEqual({ data: '{"type":"token"}' });
  });

  it("joins multi-line data with newlines, per the spec", () => {
    expect(parseSseFrame("data: line1\ndata: line2")?.data).toBe("line1\nline2");
  });

  it("captures event and id fields", () => {
    const frame = parseSseFrame("event: ping\nid: 42\ndata: {}");
    expect(frame).toEqual({ event: "ping", id: "42", data: "{}" });
  });

  it("ignores comment/heartbeat lines", () => {
    expect(parseSseFrame(": hb 1700000000")).toBeNull();
  });

  it("returns null when the frame carries no data", () => {
    expect(parseSseFrame("event: ping")).toBeNull();
  });

  it("strips only one leading space after the colon", () => {
    expect(parseSseFrame("data:  padded")?.data).toBe(" padded");
  });
});

describe("readSseStream", () => {
  it("emits one payload per frame", async () => {
    const { events } = await collect([
      'data: {"type":"token","content":"a"}\n\n',
      'data: {"type":"token","content":"b"}\n\n',
    ]);
    expect(events).toEqual([
      { type: "token", content: "a" },
      { type: "token", content: "b" },
    ]);
  });

  it("reassembles a frame split across network chunks", async () => {
    const { events } = await collect(['data: {"type":"to', 'ken","content":"x"}\n\n']);
    expect(events).toEqual([{ type: "token", content: "x" }]);
  });

  it("reassembles a frame split mid-delimiter", async () => {
    const { events } = await collect(['data: {"a":1}\n', '\ndata: {"a":2}\n\n']);
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("survives a UTF-8 sequence split across chunks", async () => {
    const encoder = new TextEncoder();
    const full = encoder.encode('data: {"t":"é"}\n\n');
    const events: Record<string, unknown>[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(full.slice(0, 12));
        controller.enqueue(full.slice(12));
        controller.close();
      },
    });
    await readSseStream(new Response(body), (p) => {
      events.push(p);
    });
    expect(events).toEqual([{ t: "é" }]);
  });

  it("reports malformed JSON instead of silently dropping it", async () => {
    const { events, parseErrors } = await collect(["data: {oops\n\n", 'data: {"ok":1}\n\n']);
    expect(events).toEqual([{ ok: 1 }]);
    expect(parseErrors).toEqual(["{oops"]);
  });

  it("skips heartbeats without emitting events", async () => {
    const { events } = await collect([": hb 1\n\n", 'data: {"type":"done"}\n\n']);
    expect(events).toEqual([{ type: "done" }]);
  });

  it("surfaces ids so a reconnect can resume", async () => {
    const { ids } = await collect(['id: 7\ndata: {"a":1}\n\n']);
    expect(ids).toEqual(["7"]);
  });

  it("ignores the [DONE] sentinel", async () => {
    const { events, parseErrors } = await collect(["data: [DONE]\n\n"]);
    expect(events).toEqual([]);
    expect(parseErrors).toEqual([]);
  });

  it("flushes a trailing frame with no blank line (stream cut)", async () => {
    const { events } = await collect(['data: {"type":"token"}']);
    expect(events).toEqual([{ type: "token" }]);
  });

  it("throws when the response has no body", async () => {
    const res = { body: null } as unknown as Response;
    await expect(readSseStream(res, vi.fn())).rejects.toThrow("No stream body");
  });
});
