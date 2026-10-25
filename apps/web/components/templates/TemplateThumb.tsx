"use client";

import { useState } from "react";
import { SiteThumb } from "@/components/SiteThumb";
import { apiBase } from "@/lib/api";

type Props = {
  template: { id: string; title: string; preview_url?: string | null; preview_image_url?: string | null };
  viewportWidth?: number;
  viewportHeight?: number;
  className?: string;
};

/**
 * A kit's gallery card: its pre-rendered `preview.png` as a plain lazy image
 * when the kit ships one, else the live `preview.html` (older kits).
 */
export function TemplateThumb({ template, viewportWidth = 480, viewportHeight = 270, className = "f-thumb-site" }: Props) {
  const [failed, setFailed] = useState(false);
  const image = template.preview_image_url;
  if (image && !failed) {
    const src = image.startsWith("http") ? image : `${apiBase()}${image}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static API image, sized by its card
      <img className={`${className} f-thumb-img`} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    );
  }
  return (
    <SiteThumb
      src={template.preview_url || `/templates/${template.id}/preview`}
      viewportWidth={viewportWidth}
      viewportHeight={viewportHeight}
      title={template.title}
      className={className}
    />
  );
}
