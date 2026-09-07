import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { UserMessageBody } from "./UserMessageBody";

vi.mock("@/lib/media-token", () => ({
  useMediaToken: () => "test-media-token",
  getMediaToken: () => "test-media-token",
  primeMediaToken: vi.fn(),
  MEDIA_TOKEN_EVENT: "forge:mediatoken",
}));

vi.mock("@/lib/i18n/I18nProvider", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        selectionBadge: "1 sélection",
        selectionMarker: "Sélection",
      })[key] || key,
    locale: "fr",
  }),
}));

vi.mock("@/lib/api", () => ({
  apiBase: () => "http://localhost:8100",
}));

describe("UserMessageBody url-capture thumbs", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          /* no-op — controlled via fireEvent in DOM img */
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves /images/url-capture paths via project public assets, not the runner", () => {
    const content = [
      "clone https://www.digba-tech.com/en",
      "",
      "[Files: url-capture-www.digba-tech.com-desktop.png]",
      "[Reference screenshot: url-capture-www.digba-tech.com-desktop.png | url:/images/url-capture-www.digba-tech.com-desktop.png | intent:reference]",
    ].join("\n");

    const { container } = render(
      <UserMessageBody
        content={content}
        projectId="proj-1"
        previewBase="http://localhost:8100/runner/?p=proj-1"
      />,
    );

    const img = container.querySelector("img.builder-msg-attach-thumb") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain("/projects/proj-1/public/images/url-capture-www.digba-tech.com-desktop.png");
    expect(img!.src).toContain("access_token=test-media-token");
    expect(img!.src).not.toContain("/runner/");
  });

  it("ignores filename object: markers and still uses public/ for url-capture", () => {
    const content =
      "[Capture de référence: url-capture-bolt.new-desktop.png | url:/images/url-capture-bolt.new-desktop.png | object:url-capture-bolt.new-desktop.png | intent:reference]";
    const { container } = render(
      <UserMessageBody content={content} projectId="proj-1" />,
    );
    const img = container.querySelector("img.builder-msg-attach-thumb") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain("/projects/proj-1/public/images/url-capture-bolt.new-desktop.png");
    expect(img!.src).not.toContain("/assets/url-capture-bolt.new-desktop.png/");
  });

  it("does not use a relative previewUrl as a bare <img src>", () => {
    const { container } = render(
      <UserMessageBody
        content="with shots"
        projectId="proj-1"
        attachments={[
          {
            name: "url-capture-bolt.new-desktop.png",
            kind: "image",
            publicUrl: "/images/url-capture-bolt.new-desktop.png",
            previewUrl: "/images/url-capture-bolt.new-desktop.png",
          },
        ]}
      />,
    );
    const img = container.querySelector("img.builder-msg-attach-thumb") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain("/projects/proj-1/public/images/url-capture-bolt.new-desktop.png");
    expect(img!.getAttribute("src")).not.toBe("/images/url-capture-bolt.new-desktop.png");
  });

  it("shows a Forge favicon placeholder when the thumb fails to load", async () => {
    const content =
      "[Reference screenshot: broken.png | url:/images/broken.png | intent:reference]";
    const { container } = render(
      <UserMessageBody content={content} projectId="proj-1" />,
    );
    const img = container.querySelector("img.builder-msg-attach-thumb") as HTMLImageElement;
    expect(img).toBeTruthy();
    img.dispatchEvent(new Event("error"));
    await waitFor(() => {
      expect(container.querySelector(".builder-msg-attach-placeholder")).toBeTruthy();
    });
    const icon = container.querySelector(
      "img.builder-msg-attach-placeholder-icon",
    ) as HTMLImageElement | null;
    expect(icon).toBeTruthy();
    expect(icon!.getAttribute("src")).toBe("/favicon.png");
  });

  it("shows a selection chip parsed from the stored marker", () => {
    const content = [
      '[Sélection: div | selector:body > main > .phone | text:"9:41 Good morning"]',
      "",
      "change the phone color to pink",
    ].join("\n");
    const { container, getByText } = render(
      <UserMessageBody content={content} projectId="proj-1" />,
    );
    expect(container.querySelector(".builder-msg-selection")).toBeTruthy();
    expect(getByText(/Sélection/i)).toBeTruthy();
    expect(getByText(/div · “9:41 Good morning”/i)).toBeTruthy();
    expect(getByText("change the phone color to pink")).toBeTruthy();
    expect(container.textContent).not.toMatch(/selector:body/);
    expect(container.textContent).not.toMatch(/11/);
  });
});
