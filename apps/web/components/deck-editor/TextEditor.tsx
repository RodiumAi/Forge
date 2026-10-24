"use client";

/**
 * Inline text editing with TipTap (MIT), loaded on demand the first time a
 * text element is double-clicked. Only the marks the slide contract can
 * store are enabled: bold, italic, underline, link, theme color, bullet and
 * numbered lists, line breaks. The box is drawn exactly like the player's
 * text element so editing is WYSIWYG.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import HardBreak from "@tiptap/extension-hard-break";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { UndoRedo } from "@tiptap/extensions";
import { DEFAULT_TOKENS, type ThemeTokens } from "@/components/deck-player";
import type { Box } from "./geometry";
import type { TextElement } from "./model";
import { docToText, textToDoc, type PMNode } from "./text-model";
import { textBoxStyle, type TextCommands, type TextMarks } from "./text-style";

export default function TextEditor({
  element,
  box,
  tokens,
  onChange,
  onDone,
  onReady,
  onMarks,
}: {
  element: TextElement;
  box: Box;
  tokens: ThemeTokens;
  onChange: (content: TextElement["content"]) => void;
  onDone: () => void;
  onReady?: (commands: TextCommands | null) => void;
  onMarks?: (marks: TextMarks) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMarksRef = useRef(onMarks);
  onMarksRef.current = onMarks;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // The initial content only: later prop changes come from this editor itself.
  const initial = useMemo(() => textToDoc(element.content), [element.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      HardBreak,
      BulletList,
      OrderedList,
      ListItem,
      TextStyle,
      Color,
      UndoRedo,
      Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, protocols: ["https"] }),
    ],
    content: initial,
    editorProps: {
      attributes: { class: "de-text-editor-content", "aria-label": "text", role: "textbox", "aria-multiline": "true" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          onDoneRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current(docToText(ed.getJSON() as PMNode)),
    onTransaction: ({ editor: ed }) => {
      onMarksRef.current?.({
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        underline: ed.isActive("underline"),
        link: ed.isActive("link"),
        bulletList: ed.isActive("bulletList"),
        orderedList: ed.isActive("orderedList"),
        color: (ed.getAttributes("textStyle").color as string | undefined) ?? null,
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.focus("end");
    onReady?.({
      toggleBold: () => editor.chain().focus().toggleBold().run(),
      toggleItalic: () => editor.chain().focus().toggleItalic().run(),
      toggleUnderline: () => editor.chain().focus().toggleUnderline().run(),
      setLink: (href) => {
        if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        else editor.chain().focus().extendMarkRange("link").unsetLink().run();
      },
      toggleBulletList: () => editor.chain().focus().toggleBulletList().run(),
      toggleOrderedList: () => editor.chain().focus().toggleOrderedList().run(),
      setColor: (css) => {
        if (css) editor.chain().focus().setColor(css).run();
        else editor.chain().focus().unsetColor().run();
      },
    });
    return () => onReady?.(null);
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...DEFAULT_TOKENS, ...tokens })) if (key.startsWith("--")) vars[key] = value;
  const align = element.style?.align ?? "left";

  return (
    <div
      className="de-text-editor"
      style={{
        ...(vars as CSSProperties),
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        minHeight: box.h,
        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        transformOrigin: "50% 50%",
        zIndex: 1,
      }}
      data-align={align}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={textBoxStyle(element)}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
