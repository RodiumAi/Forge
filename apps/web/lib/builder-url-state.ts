import type { BuilderMode, PreviewTool, ViewportMode } from "@/components/builder/types";

export type BuilderViewParam = "preview" | "files" | "codeEditor" | "more";

export type OptionsSubview =
  | "general"
  | "environment"
  | "brand"
  | "seo"
  | "publishing"
  | "stats"
  | "danger";

export type BuilderUrlState = {
  view: BuilderViewParam;
  subview: string | null;
  pane: "chat" | "workspace" | null;
  viewport: ViewportMode | null;
  page: string | null;
  tool: PreviewTool | null;
  design: boolean;
};

const OPTIONS_SUBVIEWS = new Set<string>([
  "general",
  "environment",
  "brand",
  "seo",
  "publishing",
  "stats",
  "danger",
]);

const VIEWPORT_VALUES = new Set<string>(["desktop", "tablet", "phone"]);
const TOOL_VALUES = new Set<string>(["select", "text", "comment", "image"]);
const PANE_VALUES = new Set<string>(["chat", "workspace"]);

export function modeToView(mode: BuilderMode): BuilderViewParam {
  if (mode === "code") return "codeEditor";
  if (mode === "options") return "more";
  return mode;
}

export function viewToMode(view: string | null | undefined): BuilderMode {
  switch ((view || "preview").toLowerCase()) {
    case "files":
      return "files";
    case "code":
    case "codeeditor":
      return "code";
    case "more":
    case "options":
      return "options";
    default:
      return "preview";
  }
}

export function isOptionsSubview(value: string | null | undefined): value is OptionsSubview {
  return Boolean(value && OPTIONS_SUBVIEWS.has(value));
}

export function parseBuilderUrlState(params: URLSearchParams): BuilderUrlState {
  const rawView = params.get("view");
  const view = modeToView(viewToMode(rawView));
  const subviewRaw = params.get("subview");
  const paneRaw = params.get("pane");
  const viewportRaw = params.get("viewport");
  const pageRaw = params.get("page");
  const toolRaw = params.get("tool");

  let subview: string | null = subviewRaw;
  if (view === "more" && subviewRaw && !OPTIONS_SUBVIEWS.has(subviewRaw)) {
    subview = "general";
  }

  return {
    view,
    subview,
    pane: paneRaw && PANE_VALUES.has(paneRaw) ? (paneRaw as "chat" | "workspace") : null,
    viewport:
      viewportRaw && VIEWPORT_VALUES.has(viewportRaw)
        ? (viewportRaw as ViewportMode)
        : null,
    page: pageRaw ? (pageRaw.startsWith("/") ? pageRaw : `/${pageRaw}`) : null,
    tool: toolRaw && TOOL_VALUES.has(toolRaw) ? (toolRaw as PreviewTool) : null,
    design: params.get("design") === "1",
  };
}

export function serializeBuilderUrlState(state: BuilderUrlState): string {
  const params = new URLSearchParams();

  if (state.view !== "preview") params.set("view", state.view);

  if (state.view === "more" && state.subview && state.subview !== "general") {
    params.set("subview", state.subview);
  } else if (state.view === "preview" && state.subview) {
    params.set("subview", state.subview.replace(/^\//, ""));
  } else if (state.view !== "more" && state.view !== "preview" && state.subview) {
    params.set("subview", state.subview);
  }

  if (state.pane && state.pane !== "workspace") params.set("pane", state.pane);
  if (state.viewport && state.viewport !== "desktop") params.set("viewport", state.viewport);
  if (state.page && state.page !== "/") {
    params.set("page", state.page.replace(/^\//, ""));
  }
  if (state.tool) params.set("tool", state.tool);
  if (state.design) params.set("design", "1");

  return params.toString();
}

export function builderUrlFromState(pathname: string, state: BuilderUrlState): string {
  const qs = serializeBuilderUrlState(state);
  return qs ? `${pathname}?${qs}` : pathname;
}

export function builderStateFromUi(input: {
  mainMode: BuilderMode;
  optionsSection: OptionsSubview;
  mobilePane: "chat" | "workspace";
  viewport: ViewportMode;
  previewPath: string;
  previewTool: PreviewTool | null;
  designOpen: boolean;
}): BuilderUrlState {
  const view = modeToView(input.mainMode);
  let subview: string | null = null;

  if (view === "more") {
    subview = input.optionsSection;
  } else if (view === "preview" && input.previewPath !== "/") {
    subview = input.previewPath.replace(/^\//, "");
  }

  return {
    view,
    subview,
    pane: input.mobilePane === "chat" ? "chat" : null,
    viewport: input.viewport === "desktop" ? null : input.viewport,
    page: input.previewPath !== "/" ? input.previewPath : null,
    tool: input.previewTool,
    design: input.designOpen,
  };
}
