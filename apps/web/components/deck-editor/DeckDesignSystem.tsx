"use client";

import { DesignSystemPicker } from "@/components/design-system/DesignSystemPicker";
import type { DeckT } from "./strings";

/** The design system picker at the top of the deck Theme section. */
export function DeckDesignSystem(props: {
  projectId: string;
  t: DeckT;
  readOnly?: boolean;
  onApplied: (paths: string[], designSystemId: string | null) => void;
}) {
  return <DesignSystemPicker {...props} />;
}
