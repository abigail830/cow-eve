import { useEffect, useMemo, useRef } from "react";
import { FileText, ImageIcon, Search } from "lucide-react";
import { formatBytes, isImageMime } from "../lib/attachments";
import { formatMentionTimestamp } from "../lib/attachmentMention";
import type { MentionAttachmentOption } from "../lib/attachmentUpload";
import "./ComposerAttachmentMention.css";

type Props = {
  open: boolean;
  query: string;
  selectedIndex: number;
  options: readonly MentionAttachmentOption[];
  loading?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (filename: string) => void;
  onKeyDown?: (event: React.KeyboardEvent) => boolean;
  onSelectedIndexChange: (index: number) => void;
};

function AttachmentRowIcon({ mediaType }: { mediaType: string }) {
  if (isImageMime(mediaType)) {
    return <ImageIcon size={14} strokeWidth={2} aria-hidden />;
  }
  return <FileText size={14} strokeWidth={2} aria-hidden />;
}

export function ComposerAttachmentMention({
  open,
  query,
  selectedIndex,
  options,
  loading = false,
  onQueryChange,
  onSelect,
  onKeyDown,
  onSelectedIndexChange,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.filename.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-mention-index="${selectedIndex}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, filtered.length]);

  if (!open) return null;

  return (
    <div className="composer-mention" role="listbox" aria-label="Attachment mentions">
      <div className="composer-mention-search">
        <Search size={14} strokeWidth={2} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            onKeyDown?.(e);
          }}
          placeholder="Search attachments…"
          aria-label="Search attachments"
        />
      </div>

      <div className="composer-mention-list" ref={listRef}>
        {loading ? (
          <p className="composer-mention-empty" role="status">
            Loading attachments…
          </p>
        ) : filtered.length === 0 ? (
          <p className="composer-mention-empty">
            {options.length === 0
              ? "No attachments yet. Upload a file or send one in this chat, then @ mention it."
              : "No matching attachments."}
          </p>
        ) : (
          filtered.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              data-mention-index={index}
              className={
                index === selectedIndex
                  ? "composer-mention-item is-selected"
                  : "composer-mention-item"
              }
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item.filename);
              }}
              onMouseEnter={() => onSelectedIndexChange(index)}
            >
              <span className="composer-mention-icon">
                <AttachmentRowIcon mediaType={item.mediaType} />
              </span>
              <span className="composer-mention-line">
                <span className="composer-mention-name">{item.filename}</span>
                <span className="composer-mention-meta">
                  {formatBytes(item.sizeBytes)} ·{" "}
                  {formatMentionTimestamp(item.createdAt)}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
