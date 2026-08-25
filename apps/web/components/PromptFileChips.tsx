"use client";

import { FileText, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { PromptAttachment } from "@/lib/prompt-attachments";

type PromptFileChipsProps = {
  items: PromptAttachment[];
  onRemove: (id: string) => void;
};

export function PromptFileChips({ items, onRemove }: PromptFileChipsProps) {
  if (!items.length) return null;

  return (
    <div className="landing-files">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`landing-file-chip ${item.kind === "image" ? "landing-file-chip-image" : ""}`}
          onClick={() => onRemove(item.id)}
          title={item.file.name}
        >
          {item.kind === "image" && item.previewUrl ? (
            <img src={item.previewUrl} alt="" className="landing-file-thumb" />
          ) : (
            <span className="landing-file-doc" aria-hidden>
              <Icon icon={FileText} className="ui-icon-sm" />
              <span className="landing-file-ext">{item.kind.toUpperCase()}</span>
            </span>
          )}
          <span className="landing-file-name">{item.file.name}</span>
          <Icon icon={X} className="ui-icon-sm" />
        </button>
      ))}
    </div>
  );
}
