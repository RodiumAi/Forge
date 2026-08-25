"use client";

import {
  Braces,
  File,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";

type FileIconMeta = {
  icon: LucideIcon;
  color: string;
  badge?: string;
};

function extOf(path: string): string {
  const name = path.split("/").pop() || path;
  if (name.startsWith(".") && !name.slice(1).includes(".")) {
    return name.toLowerCase(); // .env, .gitignore
  }
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function metaForPath(path: string, isDir: boolean, open?: boolean): FileIconMeta {
  if (isDir) {
    return { icon: open ? FolderOpen : Folder, color: "#e3b341" };
  }
  const ext = extOf(path);
  const name = (path.split("/").pop() || "").toLowerCase();

  if (name === "package.json" || name === "tsconfig.json" || name === "jsconfig.json") {
    return { icon: FileJson, color: "#8bc34a", badge: "JSON" };
  }
  if (name === ".env" || name.startsWith(".env.") || name === ".gitignore") {
    return { icon: Settings2, color: "#9e9e9e", badge: "ENV" };
  }

  switch (ext) {
    case "html":
    case "htm":
      return { icon: FileCode2, color: "#e44d26", badge: "HTML" };
    case "css":
      return { icon: FileCode2, color: "#264de4", badge: "CSS" };
    case "scss":
    case "sass":
      return { icon: FileCode2, color: "#c69", badge: "SCSS" };
    case "tsx":
      return { icon: FileCode2, color: "#61dafb", badge: "TSX" };
    case "ts":
      return { icon: FileCode2, color: "#3178c6", badge: "TS" };
    case "jsx":
      return { icon: FileCode2, color: "#61dafb", badge: "JSX" };
    case "js":
    case "mjs":
    case "cjs":
      return { icon: FileCode2, color: "#f7df1e", badge: "JS" };
    case "json":
      return { icon: FileJson, color: "#cbcb41", badge: "JSON" };
    case "md":
    case "mdx":
      return { icon: FileText, color: "#519aba", badge: "MD" };
    case "svg":
      return { icon: FileImage, color: "#ffb13b", badge: "SVG" };
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "ico":
      return { icon: FileImage, color: "#a074c4", badge: ext.toUpperCase() };
    case "toml":
    case "yml":
    case "yaml":
      return { icon: Settings2, color: "#cb171e", badge: ext.toUpperCase() };
    case "py":
      return { icon: FileCode2, color: "#3572a5", badge: "PY" };
    default:
      if (name.endsWith("rc") || name.includes("config")) {
        return { icon: Braces, color: "#9cdcfe", badge: "CFG" };
      }
      return { icon: File, color: "#9aa0a6" };
  }
}

export function FileTypeIcon({
  path,
  isDir = false,
  open = false,
  size = "sm",
}: {
  path: string;
  isDir?: boolean;
  open?: boolean;
  size?: "sm" | "md";
}) {
  const meta = metaForPath(path, isDir, open);
  return (
    <span
      className={`file-type-icon file-type-icon-${size}`}
      style={{ color: meta.color }}
      title={meta.badge || undefined}
      aria-hidden
    >
      <Icon icon={meta.icon} className={size === "md" ? "ui-icon-md" : "ui-icon-sm"} />
    </span>
  );
}

export function monacoLanguageForPath(path: string): string {
  const ext = extOf(path);
  const name = (path.split("/").pop() || "").toLowerCase();
  if (name === ".env" || name.startsWith(".env.")) return "ini";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
    case "htm":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    case "svg":
    case "xml":
      return "xml";
    case "yml":
    case "yaml":
      return "yaml";
    case "py":
      return "python";
    case "toml":
      return "ini";
    default:
      return "plaintext";
  }
}
