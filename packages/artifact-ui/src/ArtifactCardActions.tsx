import { Download, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { downloadArtifactFile, downloadArtifactVariant } from "./api";
import { ArtifactActionGroup } from "./InlineArtifactCardShell";

type PreviewDownloadProps = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  onPreview?: (spec: ArtifactSpec) => void;
  canPreview: boolean;
  canDownload: boolean;
  previewLabel?: string;
  downloadLabel?: string;
  chatId?: string | null;
  compact?: boolean;
};

export function PreviewDownloadActions({
  spec,
  apiBase,
  token,
  onPreview,
  canPreview,
  canDownload,
  previewLabel = "Preview",
  downloadLabel = "Download",
  chatId,
  compact = false,
}: PreviewDownloadProps) {
  const [downloading, setDownloading] = useState(false);

  if (!canPreview && !canDownload) return null;

  async function handleDownload() {
    if (!canDownload || downloading) return;
    setDownloading(true);
    try {
      await downloadArtifactFile(spec, apiBase, token ?? null, chatId);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ArtifactActionGroup>
      {canPreview ? (
        <>
          <button
            type="button"
            className={`artifact-inline-action-btn${compact ? " icon-only" : ""}`}
            onClick={() => onPreview?.(spec)}
            aria-label={previewLabel}
          >
            <Eye size={14} />
            {compact ? null : <span>{previewLabel}</span>}
          </button>
          {canDownload ? <span className="artifact-inline-action-divider" aria-hidden /> : null}
        </>
      ) : null}
      {canDownload ? (
        <button
          type="button"
          className={`artifact-inline-action-btn${compact ? " icon-only" : ""}`}
          disabled={downloading}
          onClick={() => void handleDownload()}
          aria-label={downloadLabel}
        >
          {downloading ? <Loader2 size={14} className="artifact-spin" /> : <Download size={14} />}
          {compact ? null : <span>{downloadLabel}</span>}
        </button>
      ) : null}
    </ArtifactActionGroup>
  );
}

type DownloadOnlyProps = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  downloadLabel?: string;
};

export function DownloadOnlyAction({
  spec,
  apiBase,
  token,
  downloadLabel = "Download",
}: DownloadOnlyProps) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = Boolean(spec.download_url?.trim() || spec.content?.trim());
  if (!canDownload) return null;

  return (
    <ArtifactActionGroup>
      <button
        type="button"
        className="artifact-inline-action-btn"
        disabled={downloading}
        onClick={() => {
          setDownloading(true);
          void downloadArtifactFile(spec, apiBase, token ?? null).finally(() => setDownloading(false));
        }}
        aria-label={downloadLabel}
      >
        {downloading ? <Loader2 size={14} className="artifact-spin" /> : <Download size={14} />}
        <span>{downloadLabel}</span>
      </button>
    </ArtifactActionGroup>
  );
}

type DiagramActionsProps = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  compact?: boolean;
  onPreview?: (spec: ArtifactSpec) => void;
};

export function DiagramCardActions({
  spec,
  apiBase,
  token,
  chatId,
  compact = false,
  onPreview,
}: DiagramActionsProps) {
  const [downloading, setDownloading] = useState<"svg" | "png" | null>(null);
  const canDownloadPng = Boolean(spec.png_download_url?.trim());

  async function handleDownload(variant: "svg" | "png") {
    if (downloading) return;
    setDownloading(variant);
    try {
      if (variant === "png") {
        await downloadArtifactVariant(spec, "png", apiBase, token ?? null);
      } else {
        await downloadArtifactFile(spec, apiBase, token ?? null, chatId);
      }
    } finally {
      setDownloading(null);
    }
  }

  return (
    <ArtifactActionGroup>
      <button
        type="button"
        className={`artifact-inline-action-btn${compact ? " icon-only" : ""}`}
        onClick={() => onPreview?.(spec)}
        aria-label="Preview diagram"
      >
        <Eye size={14} />
        {compact ? null : <span>Preview</span>}
      </button>
      <span className="artifact-inline-action-divider" aria-hidden />
      <button
        type="button"
        className={`artifact-inline-action-btn${compact ? " icon-only" : ""}`}
        disabled={downloading !== null}
        onClick={() => void handleDownload("svg")}
        aria-label="Download SVG"
      >
        {downloading === "svg" ? <Loader2 size={14} className="artifact-spin" /> : <Download size={14} />}
        {compact ? null : <span>SVG</span>}
      </button>
      {canDownloadPng ? (
        <>
          <span className="artifact-inline-action-divider" aria-hidden />
          <button
            type="button"
            className={`artifact-inline-action-btn${compact ? " icon-only" : ""}`}
            disabled={downloading !== null}
            onClick={() => void handleDownload("png")}
            aria-label="Download PNG"
          >
            {downloading === "png" ? <Loader2 size={14} className="artifact-spin" /> : <Download size={14} />}
            {compact ? null : <span>PNG</span>}
          </button>
        </>
      ) : null}
    </ArtifactActionGroup>
  );
}
