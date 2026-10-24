import { notFound } from "next/navigation";

import { UiGallery } from "./UiGallery";

/**
 * Development only: every component of the redesign (components/ui, the
 * composer, the template card, the app shell) in both themes, to compare with
 * the mockup at 1280px and 375px.
 */
export const dynamic = "force-dynamic";

export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
