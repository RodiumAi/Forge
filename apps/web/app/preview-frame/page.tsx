"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiBase } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { sanitizePreviewFrameSrc } from "@/lib/preview-frame-src";

type Device = "phone" | "tablet";

const DEVICE_SIZE: Record<Device, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
};

function PreviewFrameInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const src = useMemo(
    () => sanitizePreviewFrameSrc(params.get("src"), apiBase()),
    [params],
  );
  const initialDevice = params.get("device") === "tablet" ? "tablet" : "phone";
  const [device, setDevice] = useState<Device>(initialDevice);
  const size = DEVICE_SIZE[device];

  if (!src) {
    return (
      <main className="preview-frame-page">
        <p style={{ padding: "2rem" }} role="alert">
          {t("previewFrameInvalid")}
        </p>
      </main>
    );
  }

  return (
    <main className="preview-frame-page">
      <div className="preview-frame-toolbar">
        <strong>{t("previewFrameTitle")}</strong>
        <div className="platform-toggle" role="group" aria-label={t("builderViewport")}>
          <button
            type="button"
            className={device === "phone" ? "active" : undefined}
            aria-pressed={device === "phone"}
            onClick={() => setDevice("phone")}
          >
            {t("viewportPhone")}
          </button>
          <button
            type="button"
            className={device === "tablet" ? "active" : undefined}
            aria-pressed={device === "tablet"}
            onClick={() => setDevice("tablet")}
          >
            {t("viewportTablet")}
          </button>
        </div>
      </div>
      <div className="preview-frame-stage">
        <div
          className="preview-frame-device"
          style={{ width: size.width, height: size.height }}
        >
          <iframe
            title={t("previewFrameTitle")}
            src={src}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </main>
  );
}

export default function PreviewFramePage() {
  return (
    <Suspense fallback={<main className="preview-frame-page" />}>
      <PreviewFrameInner />
    </Suspense>
  );
}
