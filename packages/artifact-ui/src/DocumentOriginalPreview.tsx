import { formatBytes } from "./formatBytes";
import { OoxmlPreview } from "./OoxmlPreview";
import {
  isTextLikeOriginal,
  officePreviewKind,
  type DocumentPreviewBundle,
} from "./documentPreviewKinds";
import { useAuthenticatedBlobUrl } from "./useAuthenticatedBlobUrl";

type Props = {
  bundle: DocumentPreviewBundle;
  downloadUrl: string;
  token?: string | null;
};

function DownloadFallback({
  filename,
  sizeBytes,
  downloadUrl,
  token,
  hint,
}: {
  filename: string;
  sizeBytes: number;
  downloadUrl: string;
  token?: string | null;
  hint: string;
}) {
  async function handleDownload() {
    const res = await fetch(downloadUrl, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="document-preview-empty">
      <p>{hint}</p>
      <p className="document-preview-muted">
        {filename} · {formatBytes(sizeBytes)}
      </p>
      <button type="button" className="document-preview-link-btn" onClick={() => void handleDownload()}>
        Download original
      </button>
    </div>
  );
}

export function DocumentOriginalPreview({ bundle, downloadUrl, token }: Props) {
  const { file } = bundle;
  const kind = file.kind;
  const asText = isTextLikeOriginal(kind);
  const { src, text, loading, error } = useAuthenticatedBlobUrl(
    downloadUrl,
    token,
    {
      asText,
      blobMime: kind === "pdf" ? "application/pdf" : undefined,
    },
  );

  if (kind === "office") {
    return (
      <OoxmlPreview
        kind={officePreviewKind(file)}
        url={downloadUrl}
        token={token}
        title={file.filename}
      />
    );
  }

  if (loading) {
    return <p className="document-preview-status">Loading original…</p>;
  }

  if (error) {
    return (
      <DownloadFallback
        filename={file.filename}
        sizeBytes={file.sizeBytes}
        downloadUrl={downloadUrl}
        token={token}
        hint={error}
      />
    );
  }

  if (kind === "image" && src) {
    return (
      <div className="document-preview-original-image-wrap">
        <img src={src} alt={file.filename} className="document-preview-original-image" />
      </div>
    );
  }

  if (kind === "pdf" && src) {
    return (
      <div className="document-preview-original-pdf-wrap">
        <iframe
          title={file.filename}
          src={src}
          className="document-preview-original-pdf"
        />
      </div>
    );
  }

  if (kind === "audio" && src) {
    return (
      <div className="document-preview-original-audio">
        <audio controls src={src} className="document-preview-audio-el">
          Audio preview is not supported in this browser.
        </audio>
      </div>
    );
  }

  if (asText && text != null) {
    return (
      <pre className="document-preview-original-text">{text}</pre>
    );
  }

  return (
    <DownloadFallback
      filename={file.filename}
      sizeBytes={file.sizeBytes}
      downloadUrl={downloadUrl}
      token={token}
      hint="Preview is not available for this file type in the browser."
    />
  );
}
