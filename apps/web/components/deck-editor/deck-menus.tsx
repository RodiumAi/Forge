/**
 * Rows of the deck editor's right-click menus: on an element, on the empty
 * slide and on a thumbnail. Pure builders: DeckEditor passes what each row
 * does, so the rows stay easy to test and to reuse.
 */

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  BringToFront,
  ChevronsDown,
  ChevronsUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Group,
  ImageIcon,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Link2,
  Lock,
  LockOpen,
  Maximize2,
  MessageSquare,
  MousePointerSquareDashed,
  Paintbrush,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Scissors,
  SendToBack,
  Sparkles,
  Trash2,
  Type,
  Ungroup,
  WandSparkles,
  Wind,
  RectangleHorizontal,
  Text,
} from "lucide-react";
import type { ContextMenuEntry } from "@/components/ui/ContextMenu";
import type { SlideElement } from "@/lib/contracts/forge-design";
import type { Align } from "./geometry";
import type { ZMove } from "./model";
import type { InsertKind } from "./ops";
import type { DeckStringKey, DeckT } from "./strings";

const ico = (Icon: typeof Copy) => <Icon size={16} aria-hidden />;
const SEP = { type: "separator" } as const;

/** Ctrl on Windows and Linux, Cmd on a Mac. */
export function modKey(): string {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
}

export type ElementMenuInput = {
  t: DeckT;
  readOnly: boolean;
  /** The element right-clicked when it is the only one selected. */
  single: SlideElement | null;
  count: number;
  anyLocked: boolean;
  allLocked: boolean;
  canPaste: boolean;
  aiReady: boolean;
  /** Current rotation of `single`, 0 when straight. */
  rotation: number;
  do: {
    replaceImage: () => void;
    fit: (fit: "cover" | "contain" | "fill") => void;
    restoreRatio: () => void;
    alt: () => void;
    editText: () => void;
    ai: (action: "shorten" | "punchier" | "translate") => void;
    fillWithImage: () => void;
    enterGroup: () => void;
    ungroup: () => void;
    group: () => void;
    cut: () => void;
    copy: () => void;
    paste: () => void;
    duplicate: () => void;
    z: (move: ZMove) => void;
    align: (how: Align) => void;
    distribute: (axis: "x" | "y") => void;
    rotate: (by: number | null) => void;
    lock: (locked: boolean) => void;
    link: () => void;
    animation: () => void;
    askAi: () => void;
    remove: () => void;
  };
};

export function elementMenu(input: ElementMenuInput): ContextMenuEntry[] {
  const { t, readOnly, single, count, anyLocked, allLocked, do: act } = input;
  const mod = modKey();
  const ro = readOnly;
  const items: ContextMenuEntry[] = [];

  if (single?.type === "image") {
    const fit = single.fit ?? "cover";
    items.push(
      { id: "replace", label: t("replaceImage"), icon: ico(ImagePlus), disabled: ro, onSelect: act.replaceImage },
      {
        type: "submenu",
        id: "fit",
        label: t("fit"),
        icon: ico(Maximize2),
        disabled: ro,
        items: (["cover", "contain", "fill"] as const).map((value) => ({
          id: `fit-${value}`,
          label: t(({ cover: "fitCover", contain: "fitContain", fill: "fitFill" } as const)[value]),
          checked: fit === value,
          onSelect: () => act.fit(value),
        })),
      },
      { id: "ratio", label: t("restoreRatio"), icon: ico(RectangleHorizontal), disabled: ro || !!single.locked, onSelect: act.restoreRatio },
      { id: "alt", label: t("alt"), icon: ico(Text), disabled: ro, onSelect: act.alt },
      SEP,
    );
  } else if (single?.type === "text") {
    items.push(
      { id: "edit-text", label: t("editText"), icon: ico(PencilLine), shortcut: "Enter", disabled: ro || !!single.locked, onSelect: act.editText },
      {
        type: "submenu",
        id: "ai-rewrite",
        label: t("aiRewrite"),
        icon: ico(WandSparkles),
        disabled: ro || !input.aiReady,
        items: [
          { id: "ai-shorten", label: t("qaShorten"), onSelect: () => act.ai("shorten") },
          { id: "ai-punchier", label: t("qaPunchier"), onSelect: () => act.ai("punchier") },
          { id: "ai-translate", label: `${t("qaTranslate")}...`, onSelect: () => act.ai("translate") },
        ],
      },
      SEP,
    );
  } else if (single?.type === "shape") {
    items.push({ id: "fill-image", label: t("fillWithImage"), icon: ico(ImagePlus), disabled: ro, onSelect: act.fillWithImage }, SEP);
  } else if (single?.type === "group") {
    items.push(
      { id: "enter-group", label: t("enterGroup"), icon: ico(MousePointerSquareDashed), shortcut: "Enter", onSelect: act.enterGroup },
      { id: "ungroup", label: t("ungroup"), icon: ico(Ungroup), shortcut: `${mod}Shift+G`, disabled: ro, onSelect: act.ungroup },
      SEP,
    );
  }

  items.push(
    { id: "cut", label: t("cut"), icon: ico(Scissors), shortcut: `${mod}X`, disabled: ro || anyLocked, onSelect: act.cut },
    { id: "copy", label: t("copy"), icon: ico(Copy), shortcut: `${mod}C`, onSelect: act.copy },
    { id: "paste", label: t("paste"), icon: ico(ClipboardPaste), shortcut: `${mod}V`, disabled: ro || !input.canPaste, onSelect: act.paste },
    { id: "duplicate", label: t("duplicate"), icon: ico(CopyPlus), shortcut: `${mod}D`, disabled: ro, onSelect: act.duplicate },
    SEP,
    {
      type: "submenu",
      id: "arrange",
      label: t("arrange"),
      icon: ico(Layers),
      disabled: ro,
      items: [
        { id: "z-front", label: t("bringFront"), icon: ico(BringToFront), shortcut: `${mod}Shift+]`, onSelect: () => act.z("front") },
        { id: "z-forward", label: t("bringForward"), icon: ico(ChevronsUp), shortcut: `${mod}]`, onSelect: () => act.z("forward") },
        { id: "z-backward", label: t("sendBackward"), icon: ico(ChevronsDown), shortcut: `${mod}[`, onSelect: () => act.z("backward") },
        { id: "z-back", label: t("sendBack"), icon: ico(SendToBack), shortcut: `${mod}Shift+[`, onSelect: () => act.z("back") },
      ],
    },
    {
      type: "submenu",
      id: "align",
      label: t("align"),
      icon: ico(AlignCenterVertical),
      disabled: ro || allLocked,
      items: [
        { id: "al-left", label: t("alignLeft"), icon: ico(AlignStartVertical), onSelect: () => act.align("left") },
        { id: "al-hcenter", label: t("alignHCenter"), icon: ico(AlignCenterVertical), onSelect: () => act.align("hcenter") },
        { id: "al-right", label: t("alignRight"), icon: ico(AlignEndVertical), onSelect: () => act.align("right") },
        SEP,
        { id: "al-top", label: t("alignTop"), icon: ico(AlignStartHorizontal), onSelect: () => act.align("top") },
        { id: "al-vmiddle", label: t("alignVMiddle"), icon: ico(AlignCenterHorizontal), onSelect: () => act.align("vmiddle") },
        { id: "al-bottom", label: t("alignBottom"), icon: ico(AlignEndHorizontal), onSelect: () => act.align("bottom") },
        ...(count >= 3
          ? [
              SEP,
              { id: "dist-x", label: t("distributeH"), icon: ico(AlignHorizontalDistributeCenter), onSelect: () => act.distribute("x") },
              { id: "dist-y", label: t("distributeV"), icon: ico(AlignVerticalDistributeCenter), onSelect: () => act.distribute("y") },
            ]
          : []),
      ],
    },
  );

  if (single) {
    items.push({
      type: "submenu",
      id: "rotation",
      label: t("rotation"),
      icon: ico(RotateCw),
      disabled: ro || !!single.locked,
      items: [
        { id: "rot-right", label: t("rotateRight"), icon: ico(RotateCw), onSelect: () => act.rotate(90) },
        { id: "rot-left", label: t("rotateLeft"), icon: ico(RotateCcw), onSelect: () => act.rotate(-90) },
        { id: "rot-reset", label: t("resetRotation"), disabled: !input.rotation, onSelect: () => act.rotate(null) },
      ],
    });
  }

  if (count >= 2) items.push({ id: "group", label: t("group"), icon: ico(Group), shortcut: `${mod}G`, disabled: ro, onSelect: act.group });
  items.push(
    allLocked
      ? { id: "unlock", label: t("unlock"), icon: ico(LockOpen), disabled: ro, onSelect: () => act.lock(false) }
      : { id: "lock", label: t("lock"), icon: ico(Lock), disabled: ro, onSelect: () => act.lock(true) },
    SEP,
  );
  if (single) {
    items.push(
      { id: "link", label: t("link"), icon: ico(Link2), disabled: ro, onSelect: act.link },
      { id: "animation", label: t("animation"), icon: ico(Wind), disabled: ro, onSelect: act.animation },
    );
  }
  items.push(
    { id: "ask-ai", label: t("askAi"), icon: ico(Sparkles), disabled: ro || !input.aiReady, onSelect: act.askAi },
    SEP,
    { id: "delete", label: t("delete"), icon: ico(Trash2), shortcut: t("keyDelete"), danger: true, disabled: ro || anyLocked, onSelect: act.remove },
  );
  return items;
}

export type CanvasMenuInput = {
  t: DeckT;
  readOnly: boolean;
  canPaste: boolean;
  hasElements: boolean;
  hasBackgroundImage: boolean;
  aiReady: boolean;
  inserts: { kind: InsertKind; label: DeckStringKey }[];
  do: {
    paste: () => void;
    pasteHere: () => void;
    selectAll: () => void;
    insert: (kind: InsertKind) => void;
    insertImage: () => void;
    background: () => void;
    backgroundImage: () => void;
    removeBackgroundImage: () => void;
    changeLayout: () => void;
    transition: () => void;
    askAi: () => void;
    present: () => void;
  };
};

export function canvasMenu(input: CanvasMenuInput): ContextMenuEntry[] {
  const { t, readOnly: ro, do: act } = input;
  const mod = modKey();
  return [
    { id: "paste", label: t("paste"), icon: ico(ClipboardPaste), shortcut: `${mod}V`, disabled: ro || !input.canPaste, onSelect: act.paste },
    { id: "paste-here", label: t("pasteHere"), icon: ico(ClipboardPaste), disabled: ro || !input.canPaste, onSelect: act.pasteHere },
    { id: "select-all", label: t("selectAll"), icon: ico(MousePointerSquareDashed), shortcut: `${mod}A`, disabled: !input.hasElements, onSelect: act.selectAll },
    SEP,
    {
      type: "submenu",
      id: "insert-here",
      label: t("insertHere"),
      icon: ico(Plus),
      disabled: ro,
      items: [
        ...input.inserts.map(({ kind, label }) => ({ id: `ins-${kind}`, label: t(label), icon: kind === "text" ? ico(Type) : undefined, onSelect: () => act.insert(kind) })),
        { id: "ins-image", label: t("insertImage"), icon: ico(ImageIcon), onSelect: act.insertImage },
      ],
    },
    SEP,
    { id: "background", label: t("background"), icon: ico(Paintbrush), disabled: ro, onSelect: act.background },
    { id: "bg-image", label: t("backgroundImage"), icon: ico(ImagePlus), disabled: ro, onSelect: act.backgroundImage },
    ...(input.hasBackgroundImage
      ? [{ id: "bg-remove", label: t("removeBackgroundImage"), icon: ico(Trash2), disabled: ro, onSelect: act.removeBackgroundImage }]
      : []),
    { id: "layout", label: `${t("qaChangeLayout")}...`, icon: ico(LayoutTemplate), disabled: ro || !input.aiReady, onSelect: act.changeLayout },
    { id: "transition", label: t("transition"), icon: ico(Wind), disabled: ro, onSelect: act.transition },
    SEP,
    { id: "ask-ai", label: t("askAiSlide"), icon: ico(Sparkles), disabled: ro || !input.aiReady, onSelect: act.askAi },
    { id: "present", label: t("presentFromHere"), icon: ico(Play), onSelect: act.present },
  ];
}

export type SlideMenuInput = {
  t: DeckT;
  readOnly: boolean;
  index: number;
  total: number;
  hidden: boolean;
  aiReady: boolean;
  do: {
    addBefore: () => void;
    addAfter: () => void;
    duplicate: () => void;
    toggleHidden: () => void;
    move: (by: -1 | 1) => void;
    present: () => void;
    askAi: () => void;
    remove: () => void;
  };
};

export function slideMenu(input: SlideMenuInput): ContextMenuEntry[] {
  const { t, readOnly: ro, index, total, do: act } = input;
  return [
    { id: "add-before", label: t("newSlideBefore"), icon: ico(Plus), disabled: ro, onSelect: act.addBefore },
    { id: "add-after", label: t("newSlideAfter"), icon: ico(Plus), disabled: ro, onSelect: act.addAfter },
    { id: "duplicate", label: t("duplicateSlide"), icon: ico(CopyPlus), disabled: ro, onSelect: act.duplicate },
    { id: "hide", label: input.hidden ? t("showSlide") : t("hideSlide"), icon: ico(input.hidden ? Eye : EyeOff), disabled: ro, onSelect: act.toggleHidden },
    SEP,
    { id: "up", label: t("moveUp"), icon: ico(ArrowUp), shortcut: "Alt+↑", disabled: ro || index === 0, onSelect: () => act.move(-1) },
    { id: "down", label: t("moveDown"), icon: ico(ArrowDown), shortcut: "Alt+↓", disabled: ro || index >= total - 1, onSelect: () => act.move(1) },
    SEP,
    { id: "present", label: t("presentFromHere"), icon: ico(Play), disabled: input.hidden, onSelect: act.present },
    { id: "ask-ai", label: t("askAiSlide"), icon: ico(MessageSquare), disabled: ro || !input.aiReady, onSelect: act.askAi },
    SEP,
    { id: "delete", label: t("deleteSlide"), icon: ico(Trash2), shortcut: t("keyDelete"), danger: true, disabled: ro, onSelect: act.remove },
  ];
}
