import { apiBase, getToken } from "@/lib/api";

export type UploadResponse = {
  object_id: string;
  object_key: string;
  public_url: string;
  content_type: string;
  name: string;
  public_path?: string;
};

export async function uploadPromptAttachments(
  projectId: string,
  attachments: import("@/lib/prompt-attachments").PromptAttachment[],
  locale: string,
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
    const doUpload = () =>
      fetch(`${apiBase()}/projects/${projectId}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Accept-Language": locale,
        },
        body: fd,
        // A stalled upload used to hang sendMessage forever (input cleared,
        // chip stuck, no error). Bound it so failures surface as chat errors.
        signal: AbortSignal.timeout(60_000),
      });
    let res: Response;
    try {
      res = await doUpload();
    } catch {
      // Transient network failure ("Failed to fetch") — retry once.
      await new Promise((resolve) => setTimeout(resolve, 800));
      res = await doUpload();
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      let message = detail || "Upload failed";
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
    const data = (await res.json()) as UploadResponse;
    const durablePreview =
      data.object_id
        ? `${apiBase().replace(/\/$/, "")}/projects/${projectId}/assets/${data.object_id}/content?access_token=${encodeURIComponent(getToken() || "")}`
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
