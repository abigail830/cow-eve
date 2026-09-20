import {
  artifactDownloadPath,
  artifactPreviewPath,
  type ArtifactSpec,
} from "@fde/artifact-spec";
export function resolveArtifactUrl(url: string | null | undefined, apiBase: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = apiBase.replace(/\/$/, "");
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Prefer the live chat id over URLs baked into persisted tool output. */
export function resolveArtifactUrls(
  spec: ArtifactSpec,
  apiBase: string,
  chatId?: string | null,
): { downloadUrl: string; previewUrl: string } {
  const artifactId = spec.artifact_id?.trim();
  if (chatId?.trim() && artifactId) {
    return {
      downloadUrl: resolveArtifactUrl(artifactDownloadPath(chatId.trim(), artifactId), apiBase),
      previewUrl: resolveArtifactUrl(artifactPreviewPath(chatId.trim(), artifactId), apiBase),
    };
  }
  return {
    downloadUrl: resolveArtifactUrl(spec.download_url, apiBase),
    previewUrl: resolveArtifactUrl(spec.preview_url, apiBase),
  };
}

async function downloadFromUrl(
  url: string,
  filename: string,
  token: string | null,
): Promise<void> {
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "download";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadArtifactFile(
  spec: ArtifactSpec,
  apiBase: string,
  token: string | null,
  chatId?: string | null,
): Promise<void> {
  const { downloadUrl } = resolveArtifactUrls(spec, apiBase, chatId);
  if (!downloadUrl) return;
  await downloadFromUrl(downloadUrl, spec.filename || "download", token);
}

export async function downloadArtifactVariant(
  spec: ArtifactSpec,
  variant: "png" | "pdf",
  apiBase: string,
  token: string | null,
): Promise<void> {
  const url =
    variant === "png"
      ? resolveArtifactUrl(spec.png_download_url, apiBase)
      : resolveArtifactUrl(spec.pdf_download_url, apiBase);
  if (!url) return;
  const filename =
    variant === "png"
      ? spec.png_filename || spec.filename.replace(/\.svg$/i, ".png")
      : spec.pdf_filename || spec.filename.replace(/\.[^.]+$/, ".pdf");
  await downloadFromUrl(url, filename, token);
}

export function openArtifactPreview(spec: ArtifactSpec, apiBase: string): void {
  const url = resolveArtifactUrl(spec.preview_url, apiBase);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (isDiagramInlinePreview(spec)) {
    const blob = new Blob([spec.content], { type: "image/svg+xml" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  }
}

function isDiagramInlinePreview(spec: ArtifactSpec): boolean {
  return spec.kind === "diagram_svg" && Boolean(spec.content?.trim());
}
