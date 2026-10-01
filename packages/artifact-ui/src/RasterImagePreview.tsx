import { useEffect, useState } from "react";

type Props = {
  url: string;
  token?: string | null;
  title: string;
};

export function RasterImagePreview({ url, token, title }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let blobUrl: string | null = null;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        setObjectUrl(blobUrl);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load image");
      }
    })();

    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, token]);

  if (error) {
    return <p className="artifact-preview-status">Image preview unavailable ({error}).</p>;
  }
  if (!objectUrl) {
    return <p className="artifact-preview-status">Loading image…</p>;
  }
  return (
    <img
      className="artifact-plantuml-diagram"
      src={objectUrl}
      alt={title}
    />
  );
}
