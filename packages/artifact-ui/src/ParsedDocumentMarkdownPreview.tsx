import { memo, useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  className?: string;
  token?: string | null;
  resolveFigureUrl: (figureId: string) => string;
};

export function AuthenticatedFigureImage({
  src,
  alt,
  token,
  resolveFigureUrl,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  token?: string | null;
  resolveFigureUrl: (figureId: string) => string;
}) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const fetchUrl = useMemo(() => {
    if (!src?.trim()) return null;
    const trimmed = src.trim();
    if (trimmed.startsWith("data:") || /^https?:\/\//i.test(trimmed)) return null;
    const withoutScheme = trimmed.replace(/^figure:/i, "");
    const segment = withoutScheme.includes("/")
      ? withoutScheme.slice(withoutScheme.lastIndexOf("/") + 1)
      : withoutScheme;
    const ref = segment.split("?")[0]?.split("#")[0]?.trim() ?? "";
    if (!ref) return null;
    return resolveFigureUrl(ref);
  }, [src, resolveFigureUrl]);

  useEffect(() => {
    if (!fetchUrl) {
      setDisplaySrc(typeof src === "string" ? src : null);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setDisplaySrc(null);
    setFailed(false);

    void (async () => {
      try {
        const res = await fetch(fetchUrl, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setDisplaySrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fetchUrl, src, token]);

  if (failed) {
    return (
      <span className="parsed-doc-figure-missing" role="img" aria-label={alt ?? "Image unavailable"}>
        {alt?.trim() || "Image unavailable"}
      </span>
    );
  }

  if (!displaySrc) {
    return (
      <span className="parsed-doc-figure-loading" aria-hidden>
        …
      </span>
    );
  }

  return <img {...rest} src={displaySrc} alt={alt ?? ""} loading="lazy" />;
}

export const ParsedDocumentMarkdownPreview = memo(function ParsedDocumentMarkdownPreview({
  markdown,
  className = "",
  token,
  resolveFigureUrl,
}: Props) {
  return (
    <div className={`artifact-markdown-preview parsed-document-markdown-preview ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          /^figure:/i.test(url) ? url : defaultUrlTransform(url)
        }
        components={{
          img: ({ node, src, alt, ...props }) => {
            const resolvedSrc =
              (typeof src === "string" && src) ||
              (typeof node?.properties?.src === "string"
                ? node.properties.src
                : undefined);
            return (
              <AuthenticatedFigureImage
                {...props}
                src={resolvedSrc}
                alt={alt}
                token={token}
                resolveFigureUrl={resolveFigureUrl}
              />
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
