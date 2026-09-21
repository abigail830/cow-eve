import {
  useCallback,
  useEffect,
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
  onSend: (payload: ComposerSendPayload) => void;
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

export function Composer({
  disabled = false,
  modelLabel,
  busy = false,
  resuming = false,
  cancelling = false,
  onSend,
  onStop,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) resizeTextarea(el);
  }, []);

  useEffect(() => {
    syncHeight();
  }, [text, attachments.length, syncHeight]);

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0 || disabled || resuming) return;
      setAttachmentError(null);
      setPreparingAttachments(true);
      try {
        const prepared = await prepareAttachmentsFromFiles(files, attachments);
        setAttachments((prev) => [...prev, ...prepared]);
      } catch (err) {
        setAttachmentError(
          err instanceof Error ? err.message : "无法添加附件。",
        );
      } finally {
        setPreparingAttachments(false);
      }
    },
    [attachments, disabled, resuming],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if ((!value && attachments.length === 0) || disabled || resuming) return;
    onSend({ text: value, attachments });
    setText("");
    setAttachments([]);
    setAttachmentError(null);
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
        <ComposerStagedChips
          attachments={attachments}
          onRemove={(id) => {
            setAttachments((prev) => prev.filter((a) => a.id !== id));
            setAttachmentError(null);
          }}
        />
        {attachmentError ? (
          <p className="composer-attachment-error" role="alert">
            {attachmentError}
          </p>
        ) : null}
        {preparingAttachments ? (
          <p className="composer-attachment-status" role="status">
            正在处理附件…
          </p>
        ) : null}
        <textarea
          ref={textareaRef}
          rows={MIN_LINES}
          placeholder="输入消息… 可 📎 上传文件，或直接粘贴图片"
          disabled={inputLocked}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            requestAnimationFrame(() => {
              isComposingRef.current = false;
            });
          }}
          onKeyDown={(e) => {
            const native = e.nativeEvent;
            if (
              isComposingRef.current ||
              native.isComposing ||
              native.keyCode === 229
            ) {
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
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
              title="添加附件"
              aria-label="添加附件"
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
