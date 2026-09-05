import { apiBase, getToken } from "@/lib/api";
import { getMediaToken } from "@/lib/media-token";

export type UploadResponse = {
  object_id: string;
  object_key: string;
  public_url: string;
  content_type: string;
  name: string;
  public_path?: string;
};

/** Upload one file via XHR so we can report real progress (fetch can't). */
function uploadWithProgress(
  url: string,
  fd: FormData,
  locale: string,
  onProgress?: (pct: number) => void,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);
    xhr.setRequestHeader("Accept-Language", locale);
    // A stalled upload used to hang sendMessage forever (input cleared,
    // chip stuck, no error). Bound it so failures surface as chat errors.
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      onProgress?.(100);
      resolve({ status: xhr.status, body: xhr.responseText });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(fd);
  });
}

export async function uploadPromptAttachments(
  projectId: string,
  attachments: import("@/lib/prompt-attachments").PromptAttachment[],
  locale: string,
  onProgress?: (attachmentId: string, pct: number) => void,
): Promise<import("@/lib/prompt-attachments").PromptAttachment[]> {
  const out: import("@/lib/prompt-attachments").PromptAttachment[] = [];
  for (const item of attachments) {
    if (item.source === "project") {
      out.push(item);
      continue;
    }
    if (item.kind !== "image") {
      out.push(item);
      continue;
    }
    const fd = new FormData();
    fd.append("file", item.file);
    const uploadUrl = `${apiBase()}/projects/${projectId}/files/upload`;
    const report = (pct: number) => onProgress?.(item.id, pct);
    let res: { status: number; body: string };
    try {
      res = await uploadWithProgress(uploadUrl, fd, locale, report);
    } catch {
      // Transient network failure ("Failed to fetch") — retry once.
      await new Promise((resolve) => setTimeout(resolve, 800));
      res = await uploadWithProgress(uploadUrl, fd, locale, report);
    }
    if (res.status < 200 || res.status >= 300) {
      const detail = res.body || `Upload failed (${res.status})`;
      let message = detail;
      try {
        const parsed = JSON.parse(detail) as { detail?: string | { msg?: string }[] };
        if (typeof parsed.detail === "string") message = parsed.detail;
        else if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) {
          message = parsed.detail.map((d) => d.msg).filter(Boolean).join("; ");
        }
      } catch {
        /* keep raw body */
      }
      throw new Error(message);
    }
    const data = JSON.parse(res.body) as UploadResponse;
    const durablePreview =
      data.object_id
        ? `${apiBase().replace(/\/$/, "")}/projects/${projectId}/assets/${data.object_id}/content?access_token=${encodeURIComponent(getMediaToken() || "")}`
        : data.public_url;
    if (item.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
    out.push({
      ...item,
      publicUrl: data.public_url,
      objectId: data.object_id,
      publicPath: data.public_url,
      previewUrl: durablePreview,
    });
  }
  return out;
}

export type ProjectAsset = {
  id: string;
  name: string;
  public_url: string;
  content_type: string;
  byte_size: number;
};

export async function fetchProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  const res = await fetch(`${apiBase()}/projects/${projectId}/assets`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  return (await res.json()) as ProjectAsset[];
}
