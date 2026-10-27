"use client";

import { useParams } from "next/navigation";

import { DesignSystemEditor } from "@/components/design-system";
import "@/components/design-system/design-system.css";

/** Editor of a design_system project (`kind.editor === "design_system"`). */
export default function DesignSystemPage() {
  const params = useParams<{ id: string }>();
  return <DesignSystemEditor projectId={params.id} />;
}
