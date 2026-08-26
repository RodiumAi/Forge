"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { api } from "@/lib/api";
import { monacoLanguageForPath } from "./file-icons";
import {
  MONACO_IGNORED_DIAGNOSTIC_CODES,
  MONACO_PROJECT_EXTRA_LIB,
  buildProjectExtraLib,
} from "./monaco-extra-libs";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="code-editor-loading">…</div>,
});

type Props = {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
};

const FORGE_THEME = "forge-dark";
const EXTRA_LIB_URI = "file:///node_modules/@types/forge-project/index.d.ts";
let monacoConfigured = false;
let themeDefined = false;
let manifestApplied = false;

function modelUriForPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `file:///project/${normalized}`;
}

/**
 * Replace the ambient module declarations with ones derived from the runtime
 * manifest, so every allowed package resolves instead of showing "cannot find
 * module" (or worse, a partial hard-coded shim reporting missing exports).
 */
async function applyRuntimeManifest(monaco: Parameters<OnMount>[1]) {
  if (manifestApplied) return;
  manifestApplied = true;
  try {
    const data = await api<{ packages: Record<string, string> }>(
      "/plugins/runtime-packages",
    );
    const lib = buildProjectExtraLib(Object.keys(data.packages || {}));
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      lib,
      EXTRA_LIB_URI,
    );
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      lib,
      EXTRA_LIB_URI,
    );
  } catch {
    manifestApplied = false; // allow a later retry
  }
}

function configureMonaco(monaco: Parameters<OnMount>[1]) {
  if (monacoConfigured) return;
  monacoConfigured = true;

  const compilerOptions = {
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: false,
    strict: false,
    skipLibCheck: true,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    isolatedModules: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
  };

  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: MONACO_IGNORED_DIAGNOSTIC_CODES,
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
    compilerOptions,
  );
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...compilerOptions,
    allowJs: true,
  });
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
    diagnosticsOptions,
  );
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
    diagnosticsOptions,
  );
  // Baseline shim, immediately replaced by the manifest-derived one.
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    MONACO_PROJECT_EXTRA_LIB,
    EXTRA_LIB_URI,
  );
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    MONACO_PROJECT_EXTRA_LIB,
    EXTRA_LIB_URI,
  );
}

export function CodeEditor({ path, value, onChange, onSave }: Props) {
  const language = monacoLanguageForPath(path);
  const modelPath = modelUriForPath(path);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const handleMount: OnMount = (editor, monaco) => {
    configureMonaco(monaco);
    void applyRuntimeManifest(monaco);

    if (!themeDefined) {
      themeDefined = true;
      monaco.editor.defineTheme(FORGE_THEME, {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955", fontStyle: "italic" },
          { token: "string", foreground: "CE9178" },
          { token: "keyword", foreground: "C586C0" },
          { token: "number", foreground: "B5CEA8" },
          { token: "regexp", foreground: "D16969" },
          { token: "type", foreground: "4EC9B0" },
          { token: "class", foreground: "4EC9B0" },
          { token: "function", foreground: "DCDCAA" },
          { token: "variable", foreground: "9CDCFE" },
          { token: "constant", foreground: "4FC1FF" },
          { token: "tag", foreground: "569CD6" },
          { token: "attribute.name", foreground: "9CDCFE" },
          { token: "attribute.value", foreground: "CE9178" },
          { token: "delimiter.html", foreground: "808080" },
          { token: "metatag", foreground: "569CD6" },
        ],
        colors: {
          "editor.background": "#0d1117",
          "editor.foreground": "#e6edf3",
          "editorLineNumber.foreground": "#484f58",
          "editorLineNumber.activeForeground": "#8b949e",
          "editorCursor.foreground": "#f2620a",
          "editor.selectionBackground": "#264f78",
          "editor.inactiveSelectionBackground": "#1f3a57",
          "editor.lineHighlightBackground": "#161b22",
          "editorIndentGuide.background1": "#21262d",
          "editorIndentGuide.activeBackground1": "#30363d",
          "editorWidget.background": "#161b22",
          "editorSuggestWidget.background": "#161b22",
          "editorSuggestWidget.border": "#30363d",
          "scrollbarSlider.background": "#30363d88",
          "scrollbarSlider.hoverBackground": "#484f5888",
        },
      });
    }
    monaco.editor.setTheme(FORGE_THEME);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });
  };

  return (
    <div className="code-monaco-wrap">
      <Monaco
        key={modelPath}
        path={modelPath}
        height="100%"
        language={language}
        theme={FORGE_THEME}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, "Cascadia Code", Menlo, Consolas, monospace',
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          stickyScroll: { enabled: true },
        }}
      />
    </div>
  );
}
