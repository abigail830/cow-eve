import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { prepareAttachmentsFromFiles } from "../lib/attachmentCompress";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LIMITS,
  type PreparedAttachment,
} from "../lib/attachments";
import {
  getMentionAtCursor,
  insertMentionFilename,
  type MentionState,
} from "../lib/attachmentMention";
import {
  deleteChatAttachment,
  fetchMentionAttachments,
  mergeMentionAttachmentOptions,
  uploadChatAttachment,
  type ChatAttachmentPublic,
} from "../lib/attachmentUpload";
import { ComposerAttachmentMention } from "./ComposerAttachmentMention";
import { ComposerStagedChips } from "./ComposerStagedChips";
import "./Composer.css";

export type ComposerSendPayload = {
  text: string;
  attachments: readonly PreparedAttachment[];
};

type Props = {
  disabled?: boolean;
  modelLabel?: string;
  /** Eve status is `submitted` or `streaming`. */
  busy?: boolean;
  /** Eve status is `resuming` — no send, no Stop. */
  resuming?: boolean;
  /** cancel() accepted; still waiting for turn.cancelled / session.waiting. */
  cancelling?: boolean;
  chatId?: string | null;
  eveSessionId?: string | null;
  agentId: string;
  /** When false, attachments stay local-only (no platform library). */
  persistAttachments?: boolean;
  onSend: (payload: ComposerSendPayload) => void | Promise<void>;
  onStop: () => void;
};

const MIN_LINES = 2;
const MAX_LINES = 4;

function resizeTextarea(el: HTMLTextAreaElement) {
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  const minHeight = lineHeight * MIN_LINES;
  const maxHeight = lineHeight * MAX_LINES;

  el.style.height = "0px";
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, el.scrollHeight));
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

function filterMentionOptions(
  options: ReturnType<typeof mergeMentionAttachmentOptions>,
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((item) => item.filename.toLowerCase().includes(q));
}

export function Composer({
  disabled = false,
  modelLabel,
  busy = false,
  resuming = false,
  cancelling = false,
  chatId = null,
  eveSessionId = null,
  agentId,
  persistAttachments = true,
  onSend,
  onStop,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [libraryAttachments, setLibraryAttachments] = useState<
    ChatAttachmentPublic[]
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const effectiveChatId =
    chatId ?? attachments.find((item) => item.platformChatId)?.platformChatId ?? null;

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) resizeTextarea(el);
  }, []);

  useEffect(() => {
    syncHeight();
  }, [text, attachments.length, syncHeight]);

  const canUpload =
    persistAttachments && !disabled && !resuming && (chatId || eveSessionId);

  const mentionOptions = useMemo(
    () => mergeMentionAttachmentOptions(libraryAttachments, attachments),
    [attachments, libraryAttachments],
  );

  const filteredMentionOptions = useMemo(
    () => filterMentionOptions(mentionOptions, mention?.query ?? ""),
    [mention?.query, mentionOptions],
  );

  const syncMentionFromTextarea = useCallback(
    (value: string, cursor: number) => {
      if (isComposingRef.current) return;
      const active = getMentionAtCursor(value, cursor);
      if (!active) {
        setMention(null);
        return;
      }
      setMention((current) => ({
        ...active,
        selectedIndex:
          current &&
          current.start === active.start &&
          current.query === active.query
            ? Math.min(current.selectedIndex, Math.max(filterMentionOptions(mentionOptions, active.query).length - 1, 0))
            : 0,
      }));
    },
    [mentionOptions],
  );

  useEffect(() => {
    if (!mention) return;
    if (!persistAttachments) {
      setLibraryAttachments([]);
      return;
    }
    if (!effectiveChatId && !eveSessionId) {
      setLibraryAttachments([]);
      return;
    }

    let cancelled = false;
    setLibraryLoading(true);
    void fetchMentionAttachments({
      chatId: effectiveChatId,
      eveSessionId,
    })
      .then((items) => {
        if (!cancelled) setLibraryAttachments(items);
      })
      .catch(() => {
        if (!cancelled) setLibraryAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    mention?.start,
    effectiveChatId,
    eveSessionId,
    persistAttachments,
    attachments.length,
  ]);

  const selectMention = useCallback(
    (filename: string) => {
      const el = textareaRef.current;
      if (!el || !mention) return;
      const cursor = el.selectionStart ?? text.length;
      const { nextText, nextCursor } = insertMentionFilename(
        text,
        mention,
        cursor,
        filename,
      );
      setText(nextText);
      setMention(null);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
        syncHeight();
      });
    },
    [mention, syncHeight, text],
  );

  const updateMentionQuery = useCallback(
    (nextQuery: string) => {
      const el = textareaRef.current;
      if (!el || !mention) return;
      const cursor = el.selectionStart ?? text.length;
      const before = text.slice(0, mention.start + 1);
      const after = text.slice(cursor);
      const nextText = before + nextQuery + after;
      const nextCursor = before.length + nextQuery.length;
      setText(nextText);
      setMention({ ...mention, query: nextQuery, selectedIndex: 0 });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [mention, text],
  );

  const uploadOne = useCallback(
    async (localId: string) => {
      if (!canUpload) return;
      const current = attachmentsRef.current.find((item) => item.id === localId);
      if (!current || current.platformId || current.uploadState === "uploading") {
        return;
      }

      setAttachments((prev) =>
        prev.map((item) =>
          item.id === localId
            ? { ...item, uploadState: "uploading", uploadError: undefined }
            : item,
        ),
      );

      try {
        const saved = await uploadChatAttachment(current, {
          chatId,
          eveSessionId,
          agentId,
        });
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  platformId: saved.id,
                  platformChatId: saved.chatId,
                  uploadState: "uploaded",
                  uploadError: undefined,
                }
              : item,
          ),
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  uploadState: "error",
                  uploadError:
                    err instanceof Error ? err.message : "Upload failed",
                }
              : item,
          ),
        );
      }
    },
    [agentId, canUpload, chatId, eveSessionId],
  );

  useEffect(() => {
    if (!canUpload) return;
    for (const attachment of attachmentsRef.current) {
      if (
        !attachment.platformId &&
        attachment.uploadState !== "uploading" &&
        attachment.uploadState !== "error"
      ) {
        void uploadOne(attachment.id);
      }
    }
  }, [canUpload, chatId, eveSessionId, uploadOne]);

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0 || disabled || resuming) return;
      setAttachmentError(null);
      setPreparingAttachments(true);
      try {
        const prepared = await prepareAttachmentsFromFiles(files, attachments);
        const staged = prepared.map((item) => ({
          ...item,
          uploadState: "local" as const,
        }));
        setAttachments((prev) => [...prev, ...staged]);
        if (canUpload) {
          for (const item of staged) {
            void uploadOne(item.id);
          }
        }
      } catch (err) {
        setAttachmentError(
          err instanceof Error ? err.message : "Could not add attachment.",
        );
      } finally {
        setPreparingAttachments(false);
      }
    },
    [attachments, canUpload, disabled, resuming, uploadOne],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mention) return;
    const value = text.trim();
    if ((!value && attachments.length === 0) || disabled || resuming) return;

    const uploading = attachments.some((item) => item.uploadState === "uploading");
    if (uploading) {
      setAttachmentError("Attachments are still uploading. Please wait.");
      return;
    }

    await onSend({ text: value, attachments });
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    setMention(null);
  }

  function handleFileInputChange(list: FileList | null) {
    if (!list) return;
    void addFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file && file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    void addFiles(imageFiles);
  }

  function handleDrop(e: DragEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || resuming) return;
    void addFiles(Array.from(e.dataTransfer.files));
  }

  function handleDragOver(e: DragEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  function removeAttachment(id: string) {
    const target = attachmentsRef.current.find((item) => item.id === id);
    setAttachments((prev) => prev.filter((item) => item.id !== id));
    setAttachmentError(null);
    const deleteChatId = target?.platformChatId ?? chatId;
    if (target?.platformId && deleteChatId) {
      void deleteChatAttachment(deleteChatId, target.platformId).catch(() => {
        // Best-effort cleanup; ignore failures for unstaged deletes.
      });
    }
  }

  function handleTextChange(value: string, cursor: number) {
    setText(value);
    syncMentionFromTextarea(value, cursor);
  }

  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!mention) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.min(
                  current.selectedIndex + 1,
                  Math.max(filteredMentionOptions.length - 1, 0),
                ),
              }
            : current,
        );
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.max(current.selectedIndex - 1, 0),
              }
            : current,
        );
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        textareaRef.current?.focus();
        return true;
      }
      if (
        (e.key === "Enter" || e.key === "Tab") &&
        filteredMentionOptions.length > 0
      ) {
        e.preventDefault();
        const picked =
          filteredMentionOptions[mention.selectedIndex] ??
          filteredMentionOptions[0];
        if (picked) selectMention(picked.filename);
        return true;
      }
      return false;
    },
    [filteredMentionOptions, mention, selectMention],
  );

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const native = e.nativeEvent;
    if (
      isComposingRef.current ||
      native.isComposing ||
      native.keyCode === 229
    ) {
      return;
    }

    if (handleMentionKeyDown(e)) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(e);
    }
  }

  const hasDraft = text.trim().length > 0;
  const hasSendable = hasDraft || attachments.length > 0;
  const showStop = busy && !hasDraft && attachments.length === 0 && !resuming;
  const inputLocked = disabled || resuming || preparingAttachments;
  const attachDisabled =
    inputLocked || attachments.length >= ATTACHMENT_LIMITS.maxFilesPerMessage;

  return (
    <form
      className="composer"
      onSubmit={submit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="composer-box">
        <ComposerAttachmentMention
          open={mention !== null}
          query={mention?.query ?? ""}
          selectedIndex={mention?.selectedIndex ?? 0}
          options={mentionOptions}
          loading={libraryLoading}
          onQueryChange={updateMentionQuery}
          onSelect={selectMention}
          onKeyDown={handleMentionKeyDown}
          onSelectedIndexChange={(index) =>
            setMention((current) =>
              current ? { ...current, selectedIndex: index } : current,
            )
          }
        />
        <ComposerStagedChips
          attachments={attachments}
          onRemove={removeAttachment}
        />
        {attachmentError ? (
          <p className="composer-attachment-error" role="alert">
            {attachmentError}
          </p>
        ) : null}
        {preparingAttachments ? (
          <p className="composer-attachment-status" role="status">
            Preparing attachments…
          </p>
        ) : null}
        <textarea
          ref={textareaRef}
          rows={MIN_LINES}
          placeholder="Message… @ to mention an attachment, or attach a file"
          disabled={inputLocked}
          value={text}
          onChange={(e) =>
            handleTextChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
            )
          }
          onClick={(e) =>
            syncMentionFromTextarea(
              e.currentTarget.value,
              e.currentTarget.selectionStart ?? e.currentTarget.value.length,
            )
          }
          onKeyUp={(e) =>
            syncMentionFromTextarea(
              e.currentTarget.value,
              e.currentTarget.selectionStart ?? e.currentTarget.value.length,
            )
          }
          onPaste={handlePaste}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            requestAnimationFrame(() => {
              isComposingRef.current = false;
            });
          }}
          onKeyDown={handleComposerKeyDown}
        />
        <div className="composer-bar">
          <div className="composer-left">
            <input
              ref={fileInputRef}
              type="file"
              className="composer-file-input"
              accept={ATTACHMENT_ACCEPT}
              multiple
              disabled={attachDisabled}
              onChange={(e) => handleFileInputChange(e.target.files)}
            />
            <button
              type="button"
              className="composer-icon-btn"
              title="Attach file"
              aria-label="Attach file"
              disabled={attachDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="composer-right">
            {modelLabel ? <span className="model-tag">{modelLabel}</span> : null}
            {showStop ? (
              <button
                type="button"
                className="send-btn stop-btn"
                disabled={cancelling}
                aria-busy={cancelling}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop();
                }}
                aria-label={cancelling ? "Stopping" : "Stop"}
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn"
                disabled={inputLocked || !hasSendable}
                aria-label="Send"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
