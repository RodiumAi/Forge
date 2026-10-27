import { describe, expect, it } from "vitest";
import { withDocuments, splitDocuments, splitImages, withImages } from "./ai";
import { extractDocument, fitDocuments, ImportError, importKind, inflate, MAX_IMPORT_BYTES, pptxText, zipEntries } from "./document-import";

const enc = new TextEncoder();

// jsdom's Blob has no arrayBuffer(); browsers do, and extractPdfText uses it.
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

async function compress(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(data);
      c.close();
    },
  }).pipeThrough(new CompressionStream(format) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** A minimal zip: deflated entries, except `stored` ones (the CRC is not checked by the reader). */
async function zip(files: Record<string, string>, stored: string[] = []): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(text);
    const method = stored.includes(name) ? 0 : 8;
    const data = method === 0 ? raw : await compress(raw, "deflate-raw");
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, eocd];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function shape(text: string[], ph?: string): string {
  const nv = ph === undefined ? "<p:nvPr/>" : `<p:nvPr><p:ph${ph ? ` type="${ph}"` : ""}/></p:nvPr>`;
  const paras = text.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/>${nv}</p:nvSpPr><p:txBody><a:bodyPr/>${paras}</p:txBody></p:sp>`;
}

function slideXml(...shapes: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}><p:cSld><p:spTree>${shapes.join("")}</p:spTree></p:cSld></p:sld>`;
}

const rels = (items: Array<[string, string, string]>) =>
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`)
    .join("")}</Relationships>`;

/** Two slides; presentation.xml lists slide2.xml first, slide 1 has notes. */
async function samplePptx(): Promise<Uint8Array> {
  return zip(
    {
      "[Content_Types].xml": "<Types/>",
      "ppt/presentation.xml": `<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
      "ppt/_rels/presentation.xml.rels": rels([
        ["rId2", "slide", "slides/slide1.xml"],
        ["rId3", "slide", "slides/slide2.xml"],
      ]),
      "ppt/slides/slide1.xml": slideXml(shape(["Bilan 2026"], "title"), shape(["Ventes +12 %", "Marge stable"], ""), shape(["3"], "sldNum")),
      "ppt/slides/_rels/slide1.xml.rels": rels([["rId1", "notesSlide", "../notesSlides/notesSlide1.xml"]]),
      "ppt/notesSlides/notesSlide1.xml": `<?xml version="1.0"?><p:notes ${NS}><p:cSld><p:spTree>${shape([""], "sldImg")}${shape(["Insister sur la marge"], "body")}</p:spTree></p:cSld></p:notes>`,
      "ppt/slides/slide2.xml": slideXml(shape(["Lomé, juin 2026"], "ctrTitle"), shape(["Rapport annuel"], "subTitle"), shape(["Zone libre"])),
    },
    ["ppt/presentation.xml"],
  );
}

describe("importKind", () => {
  it("knows images, PDF and PowerPoint, nothing else", () => {
    expect(importKind({ name: "a.PNG", type: "image/png" })).toBe("image");
    expect(importKind({ name: "brief.pdf", type: "" })).toBe("pdf");
    expect(importKind({ name: "deck.pptx", type: "" })).toBe("pptx");
    expect(importKind({ name: "old.ppt", type: "application/vnd.ms-powerpoint" })).toBeNull();
    expect(importKind({ name: "notes.docx", type: "" })).toBeNull();
    expect(MAX_IMPORT_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("PowerPoint import", () => {
  it("reads the slides in presentation order with titles, body, and notes", async () => {
    const bytes = await samplePptx();
    expect(zipEntries(bytes).size).toBe(7);
    const text = await pptxText(bytes);
    expect(text).toBe(
      [
        "--- Slide 1 ---\nTitle: Lomé, juin 2026\nSubtitle: Rapport annuel\n- Zone libre",
        "--- Slide 2 ---\nTitle: Bilan 2026\n- Ventes +12 %\n- Marge stable\nNotes: Insister sur la marge",
      ].join("\n\n"),
    );
  });

  it("reads tables, entities and CDATA, and skips comments", async () => {
    const table = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Q1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>R&amp;D &lt;10&gt;</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const title = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><!-- note --><a:p><a:r><a:t><![CDATA[A & B]]> &#233;t&#xE9;</a:t></a:r></a:p></p:txBody></p:sp>`;
    const bytes = await zip({ "ppt/slides/slide1.xml": slideXml(title, table) }, []);
    expect(await pptxText(bytes)).toBe("--- Slide 1 ---\nTitle: A & B été\n- Q1 | R&D <10>");
  });

  it("counts the slides of an imported file", async () => {
    const file = new File([(await samplePptx()) as BlobPart], "deck.pptx");
    const doc = await extractDocument(file, "pptx");
    expect(doc.slides).toBe(2);
    expect(doc.truncated).toBe(false);
  });

  it("refuses a file that is not a zip", async () => {
    const file = new File(["not a zip"], "fake.pptx");
    await expect(extractDocument(file, "pptx")).rejects.toBeInstanceOf(ImportError);
  });
});

describe("PDF import", () => {
  it("reads text from a compressed (FlateDecode) content stream", async () => {
    const content = await compress(enc.encode("BT /F1 12 Tf (Chiffres cles du rapport) Tj ET"), "deflate");
    const head = enc.encode(`%PDF-1.4\n4 0 obj\n<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`);
    const tail = enc.encode("\nendstream\nendobj\n%%EOF");
    const file = new File([head as BlobPart, content as BlobPart, tail as BlobPart], "rapport.pdf", { type: "application/pdf" });
    const doc = await extractDocument(file, "pdf");
    expect(doc.text).toContain("Chiffres cles du rapport");
  });

  it("says a PDF without text operators has no readable text", async () => {
    const file = new File(["%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"], "scan.pdf", { type: "application/pdf" });
    await expect(extractDocument(file, "pdf")).rejects.toMatchObject({ code: "empty" });
  });

  it("keeps what came out of a stream with junk after its end", async () => {
    const good = await compress(enc.encode("hello"), "deflate");
    const padded = new Uint8Array([...good, 13, 10, 13, 10]);
    expect(new TextDecoder().decode(await inflate(padded, "deflate"))).toBe("hello");
  });
});

describe("message markers", () => {
  it("fits documents in what the message limit leaves", () => {
    const docs = [
      { text: "a".repeat(30_000), truncated: false },
      { text: "b".repeat(10_000), truncated: false },
    ];
    expect(fitDocuments(docs, 10)).toBe(docs);
    const fitted = fitDocuments(docs, 20_000);
    expect(fitted.every((d) => d.truncated)).toBe(true);
    expect(fitted[0].text.length + fitted[1].text.length + 20_000).toBeLessThan(50_000);
  });

  it("writes and reads document blocks next to the image line", () => {
    const content = withImages(
      withDocuments("Mets à jour", [
        { name: "deck [v2].pptx", kind: "pptx", text: "--- Slide 1 ---\nTitle: A\n[/Document]", truncated: false },
        { name: "brief.pdf", kind: "pdf", text: "Contenu", truncated: true },
      ]),
      ["public/images/a.webp"],
    );
    expect(content).toContain("[Document: deck v2 .pptx | pptx]\n--- Slide 1 ---");
    expect(content).toContain("[Document: brief.pdf | pdf | truncated]\nContenu\n[/Document]");
    const { text, documents } = splitDocuments(content);
    expect(documents).toEqual([
      { name: "deck v2 .pptx", kind: "pptx", truncated: false },
      { name: "brief.pdf", kind: "pdf", truncated: true },
    ]);
    expect(splitImages(text)).toEqual({ text: "Mets à jour", images: ["public/images/a.webp"] });
  });
});
