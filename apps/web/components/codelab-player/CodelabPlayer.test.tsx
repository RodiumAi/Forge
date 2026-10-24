import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Codelab } from "@/lib/contracts/forge-design";

import { CodelabPlayer } from "./CodelabPlayer";
import { fold, hashOfView, nextView, previousView, progressPercent, searchCodelab, viewFromHash } from "./navigation";
import { codelabTokens, schemeOf } from "./theme";

const codelab: Codelab = {
  version: 1,
  title: "API REST avec FastAPI",
  summary: "Construire une API pas à pas.",
  level: "beginner",
  durationMinutes: 20,
  prerequisites: ["Python 3.12"],
  learn: ["Créer des routes"],
  steps: [
    { id: "intro", title: "Introduction", file: "steps/01-intro.md", minutes: 5 },
    { id: "setup", file: "steps/02-setup.md", minutes: 10 },
    { id: "routes", title: "Routes", file: "steps/03-routes.md", minutes: 5 },
  ],
  downloads: [{ id: "starter", label: "Projet de départ", path: "files/starter", zip: true }],
};

const steps = {
  intro: "# Introduction\n\nBienvenue.",
  setup: "# Installation\n\n```terminal\n$ pip install fastapi\n```",
  routes: "# Routes\n\nUne route `@app.get` répond aux requêtes.",
};

const { tokens } = codelabTokens("");

function renderPlayer(extra: Partial<Parameters<typeof CodelabPlayer>[0]> = {}) {
  return render(
    <CodelabPlayer
      codelab={codelab}
      steps={steps}
      tokens={tokens}
      assetUrl={(p) => `/a/${p}`}
      storageKey="test-codelab"
      locale="fr"
      {...extra}
    />,
  );
}

describe("navigation logic", () => {
  it("maps the hash to a view and back", () => {
    expect(viewFromHash("", codelab)).toEqual({ kind: "home" });
    expect(viewFromHash("#setup", codelab)).toEqual({ kind: "step", index: 1 });
    expect(viewFromHash("#_end", codelab)).toEqual({ kind: "end" });
    expect(viewFromHash("#nope", codelab)).toEqual({ kind: "home" });
    expect(hashOfView({ kind: "step", index: 2 }, codelab)).toBe("#routes");
  });

  it("walks home, steps and end", () => {
    let view = nextView({ kind: "home" }, codelab);
    expect(view).toEqual({ kind: "step", index: 0 });
    view = nextView({ kind: "step", index: 2 }, codelab);
    expect(view).toEqual({ kind: "end" });
    expect(previousView({ kind: "end" }, codelab)).toEqual({ kind: "step", index: 2 });
    expect(previousView({ kind: "step", index: 0 }, codelab)).toEqual({ kind: "home" });
  });

  it("weights progress by minutes", () => {
    expect(progressPercent(codelab, new Set())).toBe(0);
    expect(progressPercent(codelab, new Set(["setup"]))).toBe(50);
    expect(progressPercent(codelab, new Set(["intro", "setup", "routes"]))).toBe(100);
  });

  it("searches without case nor accents and keeps offsets", () => {
    expect(fold("Étape Été")).toBe("etape ete");
    const titles = ["Introduction", "Installation", "Routes"];
    const hits = searchCodelab("REQUETES", codelab, steps, (i) => titles[i]);
    expect(hits).toHaveLength(1);
    expect(hits[0].index).toBe(2);
    expect(hits[0].match).toBe("requêtes");
    expect(searchCodelab("pip install", codelab, steps, (i) => titles[i])[0].index).toBe(1);
    expect(searchCodelab("x", codelab, steps, (i) => titles[i])).toEqual([]);
  });
});

describe("theme", () => {
  it("picks the syntax palette from the background", () => {
    expect(schemeOf({ "--bg": "#0B0D12" })).toBe("dark");
    expect(schemeOf({ "--bg": "#FFF8EE" })).toBe("light");
    expect(codelabTokens("- `--bg`: #ffffff").scheme).toBe("light");
  });
});

describe("CodelabPlayer", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens on the home page with summary, facts and downloads", () => {
    renderPlayer();
    expect(screen.getByRole("heading", { level: 1, name: codelab.title })).toBeInTheDocument();
    expect(screen.getByText("Construire une API pas à pas.")).toBeInTheDocument();
    expect(screen.getByText("Python 3.12")).toBeInTheDocument();
    expect(screen.getByText("Créer des routes")).toBeInTheDocument();
    expect(screen.getByText("Projet de départ")).toBeInTheDocument();
    // Step 2 has no title in codelab.json: its first heading is used.
    expect(screen.getByRole("button", { name: /Installation/ })).toBeInTheDocument();
  });

  it("navigates with buttons and keys, writes the hash and stores progress", async () => {
    renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: /commencer/i }));
    expect(window.location.hash).toBe("#intro");
    expect(screen.getByText("Bienvenue.")).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(window.location.hash).toBe("#setup");
    expect(screen.getByText("Étape 2 sur 3")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("test-codelab:progress") || "{}");
    expect(stored.visited).toEqual(["intro", "setup"]);
    expect(stored.last).toBe("setup");
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(window.location.hash).toBe("#intro");
  });

  it("opens the step named in the hash and ends on the recap", async () => {
    window.history.replaceState(null, "", "/#routes");
    renderPlayer({ feedbackUrl: "https://example.com/avis" });
    expect(screen.getByText(/Une route/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /terminer/i }));
    expect(screen.getByRole("heading", { name: /vous avez terminé/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /donner votre avis/i })).toHaveAttribute("href", "https://example.com/avis");
  });

  it("offers to resume where the reader left", () => {
    localStorage.setItem("test-codelab:progress", JSON.stringify({ visited: ["intro", "setup"], last: "setup" }));
    renderPlayer();
    expect(screen.getByRole("button", { name: /reprendre à l'étape 2/i })).toBeInTheDocument();
  });

  it("searches the codelab from the sidebar", () => {
    renderPlayer();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "fastapi" } });
    const result = screen.getByRole("button", { name: /2\. Installation/ });
    fireEvent.click(result);
    expect(window.location.hash).toBe("#setup");
  });

  it("renders every step in print mode", () => {
    const { container } = renderPlayer({ mode: "print" });
    expect(container.querySelectorAll("[data-step-id]")).toHaveLength(3);
    expect(container.querySelector(".fcl-side")).toBeNull();
  });

  it("shows the badge only when asked", () => {
    const { rerender } = renderPlayer();
    expect(screen.queryByText("Made with Forge")).toBeNull();
    rerender(
      <CodelabPlayer codelab={codelab} steps={steps} tokens={tokens} assetUrl={(p) => p} storageKey="b" badge />,
    );
    expect(screen.getByText("Made with Forge")).toBeInTheDocument();
  });
});

describe("design charter reading", () => {
  it("reads the DESIGN.md written by Forge (backticked tokens, font roles)", () => {
    const md = ["## Colors", "- `--bg`: #FFF8EE", "- `--accent`: #2F7D4F", "## Typography", "- display: Fraunces", "- mono: JetBrains Mono"].join("\n");
    const { tokens, scheme } = codelabTokens(md);
    expect(tokens["--bg"]).toBe("#FFF8EE");
    expect(tokens["--accent"]).toBe("#2F7D4F");
    expect(tokens["--font-display"]).toContain("Fraunces");
    expect(tokens["--font-mono"]).toContain("JetBrains Mono");
    expect(scheme).toBe("light");
  });
});

describe("font fallbacks", () => {
  it("adds a generic family after a single named font", () => {
    const { tokens } = codelabTokens("- Body font: Inter\n- Mono font: JetBrains Mono");
    expect(tokens["--font-body"]).toMatch(/^Inter, .*sans-serif$/);
    expect(tokens["--font-mono"]).toMatch(/monospace$/);
  });
});
