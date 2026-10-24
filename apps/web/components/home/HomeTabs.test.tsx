import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/SiteThumb", () => ({
  SiteThumb: ({ title }: { title?: string }) => <div data-testid="site-thumb">{title}</div>,
  invalidateThumbCache: vi.fn(),
}));
vi.mock("@/components/TemplateGallery", () => ({
  TemplateGallery: ({ kind, initialQuery }: { kind?: string; initialQuery?: string }) => (
    <div data-testid="gallery" data-kind={kind} data-query={initialQuery ?? ""} />
  ),
}));

import { useState } from "react";

import { HomeTabs, type HomeTab } from "@/components/home/HomeTabs";
import type { ProjectActions } from "@/components/home/ProjectCard";
import type { HomeProject } from "@/components/home/projects";
import { renderWithProviders, screen, within } from "@/test/render";
import type { ProjectKindId } from "@/lib/kinds";

const now = new Date().toISOString();

function project(id: string, name: string, platform: ProjectKindId, access_role = "owner"): HomeProject {
  return {
    id,
    name,
    slug: id,
    status: "ready",
    created_at: now,
    updated_at: now,
    platform,
    access_role,
    collaborators: [{ name: access_role === "owner" ? "Moi" : "Awa", email: "x@y.z", avatar_url: null }],
  };
}

const PROJECTS: HomeProject[] = [
  project("p1", "Site du café", "web"),
  project("p2", "Rapport annuel", "slides"),
  project("p3", "Appli budget", "mobile", "editor"),
  project("p4", "Marque Rodium", "design_system"),
  project("p5", "Atelier FastAPI", "codelab", "viewer"),
];

const ALL: ProjectKindId[] = ["web", "mobile", "slides", "codelab", "design_system"];

function Harness({
  initialTab = "projects",
  enabledKinds = ALL,
  onStartBlank = vi.fn(),
  favorites = new Set<string>(),
}: {
  initialTab?: HomeTab;
  enabledKinds?: ProjectKindId[];
  onStartBlank?: (kind: ProjectKindId) => void;
  favorites?: Set<string>;
}) {
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [favs, setFavs] = useState(favorites);
  const actions: ProjectActions = {
    open: vi.fn(),
    rename: vi.fn(),
    share: vi.fn(),
    remove: vi.fn(),
    isFavorite: (id) => favs.has(id),
    toggleFavorite: (id) =>
      setFavs((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    lastOpened: () => null,
  };
  return (
    <HomeTabs
      tab={tab}
      onTabChange={setTab}
      enabledKinds={enabledKinds}
      projects={PROJECTS}
      loading={false}
      actions={actions}
      favorites={favs}
      mediaToken={null}
      mounted
      templates={[{ id: "t", title: "T", description: "", tags: [], boot_hint: "", accent: null, bg: null }]}
      galleryKind="slides"
      onGalleryKindChange={vi.fn()}
      galleryQuery="pitch"
      forkingId={null}
      onFork={vi.fn()}
      onStartBlank={onStartBlank}
      onNewDesignSystem={vi.fn()}
      busy={false}
    />
  );
}

function shownNames(): string[] {
  const grid = screen.queryByRole("list", { name: /Projets|Design systems/ });
  if (grid) return within(grid).getAllByRole("listitem").map((li) => li.querySelector(".fdh-card-name")?.textContent ?? "");
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("strong")?.textContent ?? "");
}

describe("HomeTabs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists every project in the grid by default", () => {
    renderWithProviders(<Harness />);
    expect(shownNames().sort()).toEqual(
      ["Appli budget", "Atelier FastAPI", "Marque Rodium", "Rapport annuel", "Site du café"].sort(),
    );
  });

  it("filters mine and shared with me", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("button", { name: "Les miens" }));
    expect(shownNames().sort()).toEqual(["Marque Rodium", "Rapport annuel", "Site du café"]);
    await user.click(screen.getByRole("button", { name: "Partagés avec moi" }));
    expect(shownNames().sort()).toEqual(["Appli budget", "Atelier FastAPI"]);
    await user.click(screen.getByRole("button", { name: "Tous" }));
    expect(shownNames()).toHaveLength(5);
  });

  it("filters by type and by search", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par type" }), "slides");
    expect(shownNames()).toEqual(["Rapport annuel"]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par type" }), "");
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un projet" }), "café");
    expect(shownNames()).toEqual(["Site du café"]);
  });

  it("stars a project and filters on favourites", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("button", { name: "Ajouter Rapport annuel aux favoris" }));
    expect(screen.getByRole("button", { name: "Retirer Rapport annuel des favoris" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Favoris" }));
    expect(shownNames()).toEqual(["Rapport annuel"]);
  });

  it("switches between grid and list and remembers it", async () => {
    const { user, unmount } = renderWithProviders(<Harness />);
    expect(screen.queryByRole("table")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Vue liste" }));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Propriétaire" })).toBeInTheDocument();
    // Owner column: "Vous" for mine, the owner's name for a shared project.
    const shared = within(table).getByText("Appli budget").closest("tr") as HTMLElement;
    expect(within(shared).getByText("Awa")).toBeInTheDocument();
    expect(within(shared).getByText("Peut modifier")).toBeInTheDocument();
    const viewer = within(table).getByText("Atelier FastAPI").closest("tr") as HTMLElement;
    expect(within(viewer).getByText("Lecture seule")).toBeInTheDocument();
    unmount();
    renderWithProviders(<Harness />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("only offers owner actions on owned projects", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("button", { name: "Actions pour Site du café" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Ouvrir",
      "Renommer",
      "Partager",
      "Supprimer",
    ]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Actions pour Appli budget" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Ouvrir"]);
  });

  it("the design systems tab lists design systems only", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Design systems" }));
    expect(screen.getByRole("tab", { name: "Design systems" })).toHaveAttribute("aria-selected", "true");
    expect(shownNames()).toEqual(["Marque Rodium"]);
  });

  it("hides the design systems tab while the kind is off", () => {
    renderWithProviders(<Harness enabledKinds={["web", "mobile"]} />);
    expect(screen.queryByRole("tab", { name: "Design systems" })).toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Projets", "Modèles"]);
  });

  it("moves between tabs with the arrow keys", async () => {
    const { user } = renderWithProviders(<Harness />);
    screen.getByRole("tab", { name: "Projets" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Design systems" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Design systems" })).toHaveAttribute("aria-selected", "true");
  });

  it("the templates tab shows the gallery of the chosen kind and a blank start", async () => {
    const onStartBlank = vi.fn();
    const { user } = renderWithProviders(<Harness initialTab="templates" onStartBlank={onStartBlank} />);
    const gallery = screen.getByTestId("gallery");
    expect(gallery).toHaveAttribute("data-kind", "slides");
    expect(gallery).toHaveAttribute("data-query", "pitch");
    await user.click(screen.getByRole("button", { name: "Commencer sans modèle" }));
    expect(onStartBlank).toHaveBeenCalledWith("slides");
  });
});
