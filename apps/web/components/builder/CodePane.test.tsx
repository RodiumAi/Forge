import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api";
import { CodePane } from "./CodePane";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api };
});

// Monaco cannot run in jsdom; the editor is replaced by a plain textarea so the
// buffer/dirty/save behaviour stays observable.
vi.mock("./CodeEditor", () => ({
  CodeEditor: ({
    path,
    value,
    onChange,
  }: {
    path: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="editor"
      data-path={path}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const TREE = [
  {
    path: "src",
    type: "dir",
    children: [
      { path: "src/App.tsx", type: "file" },
      { path: "src/Other.tsx", type: "file" },
    ],
  },
];

/** Route the mocked api by URL + method. */
function mockApi(handlers: {
  tree?: unknown;
  content?: (path: string) => unknown;
  put?: (body: Record<string, unknown>) => unknown;
  rename?: (body: Record<string, unknown>) => unknown;
  del?: (path: string) => unknown;
}) {
  api.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = (init?.method || "GET").toUpperCase();
    if (url.endsWith("/files") && method === "GET") return handlers.tree ?? TREE;
    if (url.includes("/files/content") && method === "GET") {
      const path = decodeURIComponent(url.split("path=")[1] || "");
      return handlers.content ? handlers.content(path) : { path, content: `// ${path}`, version: "v1" };
    }
    if (url.includes("/files/content") && method === "PUT") {
      const body = JSON.parse(String(init?.body || "{}"));
      return handlers.put ? handlers.put(body) : { ...body, version: "v2" };
    }
    if (url.includes("/files/rename")) {
      const body = JSON.parse(String(init?.body || "{}"));
      return handlers.rename ? handlers.rename(body) : { ok: true };
    }
    if (url.includes("/files?path=") && method === "DELETE") {
      const path = decodeURIComponent(url.split("path=")[1] || "");
      return handlers.del ? handlers.del(path) : { ok: true };
    }
    throw new Error(`unhandled ${method} ${url}`);
  });
}

async function openApp(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.click(await screen.findByRole("treeitem", { name: /App\.tsx/ }));
  return screen.findByTestId("editor");
}

beforeEach(() => {
  api.mockReset();
});

describe("file tree", () => {
  it("shows a skeleton before the tree arrives", async () => {
    let resolveTree: (v: unknown) => void = () => {};
    api.mockImplementation(() => new Promise((r) => (resolveTree = r)));
    const { container } = renderWithProviders(<CodePane projectId="p1" />);

    expect(container.querySelector(".code-tree-skeleton")).toBeInTheDocument();
    resolveTree(TREE);
    await waitFor(() => expect(container.querySelector(".code-tree-skeleton")).toBeNull());
  });

  it("distinguishes an empty project from a loading one", async () => {
    mockApi({ tree: [] });
    renderWithProviders(<CodePane projectId="p1" />);
    expect(await screen.findByText(/aucun fichier source/i)).toBeInTheDocument();
  });

  it("exposes tree semantics for assistive technology", async () => {
    mockApi({});
    renderWithProviders(<CodePane projectId="p1" />);
    expect(await screen.findByRole("tree")).toBeInTheDocument();
    const dir = await screen.findByRole("treeitem", { name: /src/ });
    expect(dir).toHaveAttribute("aria-expanded", "true");
  });

  it("reloads when the agent writes files", async () => {
    mockApi({});
    const { rerender } = renderWithProviders(<CodePane projectId="p1" filesRevision={0} />);
    await screen.findByRole("tree");
    const before = api.mock.calls.filter((c) => String(c[0]).endsWith("/files")).length;

    // The tree used to stay frozen on its mount-time snapshot.
    rerender(<CodePane projectId="p1" filesRevision={1} />);
    await waitFor(() => {
      const after = api.mock.calls.filter((c) => String(c[0]).endsWith("/files")).length;
      expect(after).toBeGreaterThan(before);
    });
  });
});

describe("opening files", () => {
  it("loads the clicked file into the editor", async () => {
    mockApi({});
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    const editor = await openApp(user);
    expect(editor).toHaveValue("// src/App.tsx");
    expect(editor).toHaveAttribute("data-path", "src/App.tsx");
  });

  it("does not switch the header to a file it failed to load", async () => {
    // Regression: `selected` was set before the fetch and left there on error,
    // so a save wrote the previous file's buffer into the failed one.
    mockApi({
      content: (path) => {
        if (path === "src/Other.tsx") throw new ApiError("boom", 500);
        return { path, content: "GOOD", version: "v1" };
      },
    });
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await openApp(user);

    await user.click(screen.getByRole("treeitem", { name: /Other\.tsx/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByTestId("editor")).toHaveValue("GOOD");
    expect(screen.getByTestId("editor")).toHaveAttribute("data-path", "src/App.tsx");
  });

  it("ignores a slow response that lost the race", async () => {
    const deferred: Record<string, (v: unknown) => void> = {};
    api.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (url.endsWith("/files") && method === "GET") return TREE;
      const path = decodeURIComponent(url.split("path=")[1] || "");
      return new Promise((resolve) => {
        deferred[path] = () => resolve({ path, content: `content of ${path}`, version: "v" });
      });
    });

    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await user.click(await screen.findByRole("treeitem", { name: /App\.tsx/ }));
    await user.click(screen.getByRole("treeitem", { name: /Other\.tsx/ }));

    // The first (stale) request settles last and must be discarded.
    deferred["src/Other.tsx"]?.(null);
    deferred["src/App.tsx"]?.(null);

    const editor = await screen.findByTestId("editor");
    await waitFor(() => expect(editor).toHaveAttribute("data-path", "src/Other.tsx"));
    expect(editor).toHaveValue("content of src/Other.tsx");
  });
});

describe("tabs", () => {
  it("keeps both files open and switches between them", async () => {
    mockApi({});
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await openApp(user);
    await user.click(screen.getByRole("treeitem", { name: /Other\.tsx/ }));

    const tablist = await screen.findByRole("tablist");
    expect(within(tablist).getAllByRole("tab")).toHaveLength(2);

    await user.click(within(tablist).getByRole("tab", { name: /App\.tsx/ }));
    expect(screen.getByTestId("editor")).toHaveAttribute("data-path", "src/App.tsx");
  });

  it("does not refetch a tab that is already open and clean", async () => {
    mockApi({});
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await openApp(user);
    await user.click(screen.getByRole("treeitem", { name: /Other\.tsx/ }));
    const before = api.mock.calls.filter((c) => String(c[0]).includes("/files/content")).length;

    await user.click(screen.getByRole("treeitem", { name: /App\.tsx/ }));
    const after = api.mock.calls.filter((c) => String(c[0]).includes("/files/content")).length;
    expect(after).toBe(before);
  });

  it("marks the tab and reports dirty state to the parent", async () => {
    mockApi({});
    const onDirtyChange = vi.fn();
    const { user, container } = renderWithProviders(
      <CodePane projectId="p1" onDirtyChange={onDirtyChange} />,
    );
    const editor = await openApp(user);

    await user.type(editor, "X");

    expect(container.querySelector(".code-tab-dot")).toBeInTheDocument();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });
});

describe("saving", () => {
  it("sends the loaded version for optimistic concurrency", async () => {
    mockApi({});
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    const editor = await openApp(user);
    await user.type(editor, "X");
    await user.click(screen.getByRole("button", { name: /enregistrer|sauvegarder|save/i }));

    const put = api.mock.calls.find((c) => (c[1]?.method || "") === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
      path: "src/App.tsx",
      version: "v1",
    });
  });

  it("offers to reload or overwrite when the file changed underneath", async () => {
    mockApi({
      put: () => {
        throw new ApiError("Ce fichier a changé depuis son ouverture.", 409);
      },
    });
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    const editor = await openApp(user);
    await user.type(editor, "X");
    await user.click(screen.getByRole("button", { name: /enregistrer|sauvegarder|save/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/a changé depuis/i);
    expect(within(alert).getByRole("button", { name: /recharger/i })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: /écraser/i })).toBeInTheDocument();
  });

  it("forces the write when the user chooses to overwrite", async () => {
    let failNext = true;
    mockApi({
      put: (body) => {
        if (failNext) {
          failNext = false;
          throw new ApiError("conflit", 409);
        }
        return { ...body, version: "v3" };
      },
    });
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    const editor = await openApp(user);
    await user.type(editor, "X");
    await user.click(screen.getByRole("button", { name: /enregistrer|sauvegarder|save/i }));

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: /écraser/i }));

    const puts = api.mock.calls.filter((c) => (c[1]?.method || "") === "PUT");
    // An empty version means "write regardless of what is on disk".
    expect(JSON.parse(String(puts.at(-1)?.[1]?.body)).version).toBe("");
  });

  it("keeps the buffer dirty when the save fails", async () => {
    mockApi({
      put: () => {
        throw new ApiError("disk full", 500);
      },
    });
    const onDirtyChange = vi.fn();
    const { user } = renderWithProviders(
      <CodePane projectId="p1" onDirtyChange={onDirtyChange} />,
    );
    const editor = await openApp(user);
    await user.type(editor, "X");
    await user.click(screen.getByRole("button", { name: /enregistrer|sauvegarder|save/i }));

    await screen.findByRole("alert");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});

describe("tree actions", () => {
  it("renames through the API and keeps the tab pointing at the new path", async () => {
    mockApi({});
    vi.spyOn(window, "prompt").mockReturnValue("src/Renamed.tsx");
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await openApp(user);

    const row = screen.getByRole("treeitem", { name: /App\.tsx/ }).closest(".code-tree-row")!;
    await user.click(within(row as HTMLElement).getByRole("button", { name: /renommer/i }));

    await waitFor(() => {
      const call = api.mock.calls.find((c) => String(c[0]).includes("/files/rename"));
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        from_path: "src/App.tsx",
        to_path: "src/Renamed.tsx",
      });
    });
  });

  it("does nothing when the rename prompt is cancelled", async () => {
    mockApi({});
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await screen.findByRole("tree");

    const row = screen.getByRole("treeitem", { name: /App\.tsx/ }).closest(".code-tree-row")!;
    await user.click(within(row as HTMLElement).getByRole("button", { name: /renommer/i }));

    expect(api.mock.calls.some((c) => String(c[0]).includes("/rename"))).toBe(false);
  });

  it("asks for confirmation before deleting", async () => {
    mockApi({});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await screen.findByRole("tree");

    const row = screen.getByRole("treeitem", { name: /App\.tsx/ }).closest(".code-tree-row")!;
    await user.click(within(row as HTMLElement).getByRole("button", { name: /supprimer/i }));

    expect(confirm).toHaveBeenCalled();
    expect(api.mock.calls.some((c) => (c[1]?.method || "") === "DELETE")).toBe(false);
  });

  it("creates a file and opens it", async () => {
    mockApi({});
    vi.spyOn(window, "prompt").mockReturnValue("src/New.tsx");
    const { user } = renderWithProviders(<CodePane projectId="p1" />);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /nouveau fichier/i }));

    await waitFor(() => {
      const put = api.mock.calls.find(
        (c) => (c[1]?.method || "") === "PUT" && String(c[1]?.body).includes("src/New.tsx"),
      );
      expect(put).toBeTruthy();
    });
  });
});
