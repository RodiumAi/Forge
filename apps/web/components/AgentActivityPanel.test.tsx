import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { AgentActivityPanel } from "./AgentActivityPanel";

const STEPS = [
  { id: "s1", label: "Analyse", status: "done" },
  { id: "s2", label: "Génération", status: "running" },
];

describe("empty state", () => {
  it("renders nothing without content", () => {
    const { container } = renderWithProviders(<AgentActivityPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders when only an effort label is present", () => {
    renderWithProviders(<AgentActivityPanel effortLabel="medium" />);
    expect(screen.getByText("medium")).toBeInTheDocument();
  });
});

describe("steps collapse", () => {
  it("is expanded for the live turn", () => {
    renderWithProviders(<AgentActivityPanel steps={STEPS} live />);
    expect(screen.getByText("Analyse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /étapes/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("is collapsed for a historic turn", () => {
    // Everything used to stay expanded forever, which made the thread unreadable.
    renderWithProviders(<AgentActivityPanel steps={STEPS} />);
    expect(screen.queryByText("Analyse")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /étapes/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("summarises the collapsed steps", () => {
    renderWithProviders(<AgentActivityPanel steps={STEPS} />);
    expect(screen.getByText(/1 étapes/)).toBeInTheDocument();
  });

  it("reports failures in the summary instead of a count", () => {
    renderWithProviders(
      <AgentActivityPanel steps={[{ id: "s1", label: "x", status: "error" }]} />,
    );
    expect(screen.getByText(/1 en échec/)).toBeInTheDocument();
  });

  it("can be toggled open", async () => {
    const { user } = renderWithProviders(<AgentActivityPanel steps={STEPS} />);
    await user.click(screen.getByRole("button", { name: /étapes/i }));
    expect(screen.getByText("Analyse")).toBeInTheDocument();
  });
});

describe("thinking collapse", () => {
  it("stays collapsed by default, even live", () => {
    renderWithProviders(<AgentActivityPanel thinking="secret reasoning" live />);
    expect(screen.queryByText("secret reasoning")).not.toBeInTheDocument();
  });

  it("reveals the reasoning on demand", async () => {
    const { user } = renderWithProviders(<AgentActivityPanel thinking="secret reasoning" />);
    await user.click(screen.getByRole("button", { name: /raisonnement/i }));
    expect(screen.getByText("secret reasoning")).toBeInTheDocument();
  });
});

describe("file operations", () => {
  const OPS = [
    { op: "write", path: "src/App.tsx" },
    { op: "delete", path: "src/Old.tsx" },
  ];

  // File paths stay in props/state for applied/preview refresh, but the panel
  // no longer lists them (Replit/Lovable-style: progress, not paths).
  it("does not render file paths (kept under the hood)", () => {
    const { container } = renderWithProviders(<AgentActivityPanel fileOps={OPS} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("src/App.tsx")).not.toBeInTheDocument();
    expect(screen.queryByText("src/Old.tsx")).not.toBeInTheDocument();
  });

  it("still accepts a legacy array of plain paths without rendering them", () => {
    const { container } = renderWithProviders(
      <AgentActivityPanel fileOps={["src/Legacy.tsx"]} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("src/Legacy.tsx")).not.toBeInTheDocument();
  });

  it("does not call onOpenFile when only fileOps are present", () => {
    const onOpenFile = vi.fn();
    renderWithProviders(<AgentActivityPanel fileOps={OPS} onOpenFile={onOpenFile} />);
    expect(onOpenFile).not.toHaveBeenCalled();
  });
});

describe("warnings", () => {
  it("surfaces import violations that used to be dropped silently", () => {
    renderWithProviders(
      <AgentActivityPanel
        warnings={[
          { code: "BACKEND_SDK_FORBIDDEN", path: "src/App.tsx", message: "backend SDK" },
        ]}
      />,
    );
    const warning = screen.getByText(/backend SDK/).closest("li")!;
    expect(within(warning).getByText("src/App.tsx")).toBeInTheDocument();
  });

  it("renders a warning without a path", () => {
    renderWithProviders(<AgentActivityPanel warnings={[{ message: "preview may stay black" }]} />);
    expect(screen.getByText(/preview may stay black/)).toBeInTheDocument();
  });
});
