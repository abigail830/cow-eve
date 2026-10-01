import { useEffect, useState } from "react";

export function useAuthenticatedBlobUrl(
  url: string | null,
  token?: string | null,
  options?: { asText?: boolean; blobMime?: string },
): { src: string | null; text: string | null; loading: boolean; error: string | null } {
  const [src, setSrc] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setText(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setSrc(null);
    setText(null);

    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        if (options?.asText) {
          const body = await res.text();
          if (!cancelled) setText(body);
        } else {
          const raw = await res.blob();
          const blob =
            options?.blobMime && raw.type !== options.blobMime
              ? new Blob([await raw.arrayBuffer()], { type: options.blobMime })
              : raw;
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setSrc(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token, options?.asText, options?.blobMime]);

  return { src, text, loading, error };
}
