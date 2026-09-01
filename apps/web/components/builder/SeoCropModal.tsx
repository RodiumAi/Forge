"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  imageSrc: string;
  aspect: number;
  title: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

async function cropToBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/png",
      0.92,
    );
  });
}

export function SeoCropModal({ open, imageSrc, aspect, title, onCancel, onConfirm }: Props) {
  const { t } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setArea(croppedAreaPixels);
  }, []);

  if (!open) return null;

  async function confirm() {
    if (!area) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(imageSrc, area);
      onConfirm(blob);
    } catch {
      /* parent may show error */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seo-crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="seo-crop-modal">
        <header className="seo-crop-head">
          <h4>{title}</h4>
          <button type="button" className="btn btn-ghost" onClick={onCancel} title={t("close")}>
            <Icon icon={X} className="ui-icon-sm" />
          </button>
        </header>
        <div className="seo-crop-stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="seo-crop-controls">
          <label htmlFor="seo-crop-zoom">
            {t("optionsSeoZoom")}
            <input
              id="seo-crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <div className="options-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              {t("close")}
            </button>
            <button type="button" className="btn" onClick={() => void confirm()} disabled={busy || !area}>
              {t("optionsSeoApplyCrop")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
