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
import { ArrowUp, FolderOpen, Paperclip, Square } from "lucide-react";
import { prepareAttachmentsFromFiles } from "../lib/attachmentCompress";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LIMITS,
  isImageMime,
  type PreparedAttachment,
} from "../lib/attachments";
import {
  getMentionAtCursor,
  insertMentionFilename,
  type MentionState,
} from "../lib/attachmentMention";
import {
  mergeExplicitMentionIds,
  parseDocumentMentionIds,
} from "../lib/documentMentions";
import type { MentionAttachmentOption } from "../lib/attachmentUpload";
import {
  ATTACHMENT_PARSE_POLL_MS,
  attachmentNeedsParsePoll,
  effectiveParseStatus,
  attachmentParseInProgress,
  isAttachmentReadyForSend,
} from "../lib/attachmentParseProgress";
import { mergeAttachmentIdsForSend } from "../lib/attachmentSend";
import {
  deleteChatAttachment,
  fetchMentionAttachments,
  mergeMentionAttachmentOptions,
  uploadChatAttachment,
  type ChatAttachmentPublic,
} from "../lib/attachmentUpload";
import { useComposerAudioDraft } from "./ComposerAudioSection";
import type { WorkspaceFilePublic } from "../lib/workspace";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import { ComposerAttachmentMention } from "./ComposerAttachmentMention";
import { ComposerStagedChips } from "./ComposerStagedChips";
import { ComposerWorkspaceChips } from "./ComposerWorkspaceChips";
import { ComposerWorkspaceImportModal } from "./ComposerWorkspaceImportModal";
import "./Composer.css";

export type ComposerSendPayload = {
  text: string;
  attachments: readonly PreparedAttachment[];
  /** Platform attachment ids referenced this turn (staged + @mentions). */
  attachmentIds: readonly string[];
  /** Workspace file ids referenced this turn (import chips). */
  workspaceFileIds: readonly string[];
  /** Resolved workspace rows for optimistic message chips (same order as ids). */
  workspaceFiles: readonly WorkspaceFilePublic[];
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
  parseDrawerAttachment?: ChatAttachmentPublic | null;
  onParseDrawerAttachmentChange?: (
    row: ChatAttachmentPublic | null | ((prev: ChatAttachmentPublic | null) => ChatAttachmentPublic | null),
  ) => void;
  onAudioCaptureActivity?: () => void;
  onCaptureChatLinked?: (chatId: string) => void;
  onCaptureStarted?: (capture: import("../lib/audioCapture").AudioCapturePublic) => void;
  /** Workspace files referenced earlier in this chat (for @ mentions). */
  sessionWorkspaceFiles?: readonly WorkspaceFilePublic[];
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
  parseDrawerAttachment: parseDrawerAttachmentProp = null,
  onParseDrawerAttachmentChange,
  onAudioCaptureActivity,
  onCaptureChatLinked,
  onCaptureStarted,
  sessionWorkspaceFiles = [],
  onSend,
  onStop,
}: Props) {
  const [text, setText] = useState("");
  const [workspaceImports, setWorkspaceImports] = useState<
    WorkspaceFilePublic[]
  >([]);
  const [workspaceImportOpen, setWorkspaceImportOpen] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [libraryAttachments, setLibraryAttachments] = useState<
    ChatAttachmentPublic[]
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [parseDrawerAttachmentInternal, setParseDrawerAttachmentInternal] =
    useState<ChatAttachmentPublic | null>(null);
  const parseDrawerAttachment =
    onParseDrawerAttachmentChange !== undefined
      ? parseDrawerAttachmentProp
      : parseDrawerAttachmentInternal;
  const setParseDrawerAttachment = onParseDrawerAttachmentChange ?? setParseDrawerAttachmentInternal;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const explicitMentionPicksRef = useRef<MentionAttachmentOption[]>([]);

  const effectiveChatId =
    chatId ?? attachments.find((item) => item.platformChatId)?.platformChatId ?? null;

  const audioDraft = useComposerAudioDraft({
    chatId: effectiveChatId,
    eveSessionId,
    agentId,
    disabled: disabled || resuming || preparingAttachments,
    onCaptureActivity: onAudioCaptureActivity,
    onCaptureChatLinked,
    onCaptureStarted,
  });

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) resizeTextarea(el);
  }, []);

  useEffect(() => {
    syncHeight();
  }, [text, attachments.length, syncHeight]);

  const canUpload =
    persistAttachments && !disabled && !resuming && (chatId || eveSessionId);

  const workspaceMentionSource = useMemo(
    () =>
      [...sessionWorkspaceFiles, ...workspaceImports].map((file) => ({
        id: file.id,
        filename: file.filename,
        mediaType: file.mediaType,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
      })),
    [sessionWorkspaceFiles, workspaceImports],
  );

  const mentionOptions = useMemo(
    () =>
      mergeMentionAttachmentOptions(
        libraryAttachments,
        attachments,
        workspaceMentionSource,
      ),
    [attachments, libraryAttachments, workspaceMentionSource],
  );

  const filteredMentionOptions = useMemo(
    () => filterMentionOptions(mentionOptions, mention?.query ?? ""),
    [mention?.query, mentionOptions],
  );

  const libraryById = useMemo(() => {
    const map = new Map<string, ChatAttachmentPublic>();
    for (const row of libraryAttachments) map.set(row.id, row);
    return map;
  }, [libraryAttachments]);

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

  const stagedPlatformIds = useMemo(
    () =>
      attachments
        .map((item) => item.platformId)
        .filter((id): id is string => Boolean(id)),
    [attachments],
  );

  const parseDrawerNeedsPoll = useMemo(() => {
    if (!parseDrawerAttachment) return false;
    const status = effectiveParseStatus(parseDrawerAttachment);
    return status === "pending" || status === "running";
  }, [parseDrawerAttachment]);

  const shouldPollParse = useMemo(() => {
    if (!persistAttachments) return false;
    if (parseDrawerNeedsPoll) return true;
    if (stagedPlatformIds.length === 0) return false;
    const rows = libraryAttachments.filter((row) =>
      stagedPlatformIds.includes(row.id),
    );
    return attachmentNeedsParsePoll(rows);
  }, [
    libraryAttachments,
    parseDrawerNeedsPoll,
    persistAttachments,
    stagedPlatformIds,
  ]);

  const waitingForUploadSession = useMemo(() => {
    if (!persistAttachments || attachments.length === 0) return false;
    return !(chatId || eveSessionId);
  }, [attachments.length, chatId, eveSessionId, persistAttachments]);

  const sendBlockedByParse = useMemo(() => {
    if (!persistAttachments) return false;
    if (waitingForUploadSession) return true;

    const mentionSplit = parseDocumentMentionIds(text, mentionOptions);
    for (const id of mentionSplit.attachmentIds) {
      const row = libraryById.get(id);
      if (!row || !isAttachmentReadyForSend(row)) return true;
    }
    for (const id of mentionSplit.workspaceFileIds) {
      const file = [...sessionWorkspaceFiles, ...workspaceImports].find(
        (row) => row.id === id,
      );
      if (!file) return true;
      if (!isAttachmentReadyForSend(workspaceFileAsAttachmentRow(file))) {
        return true;
      }
    }

    if (attachments.length === 0) return false;

    for (const item of attachments) {
      if (item.uploadState === "uploading" || item.uploadState === "local") {
        return true;
      }
      if (!item.platformId) {
        if (!isImageMime(item.mediaType) && item.uploadState !== "error") {
          return true;
        }
        continue;
      }
      const row = libraryById.get(item.platformId);
      if (!row) return true;
      if (!isAttachmentReadyForSend(row)) return true;
    }

    return false;
  }, [
    attachments,
    libraryAttachments,
    libraryById,
    persistAttachments,
    mentionOptions,
    sessionWorkspaceFiles,
    text,
    waitingForUploadSession,
    workspaceImports,
  ]);

  useEffect(() => {
    if (!shouldPollParse) return;
    if (!effectiveChatId && !eveSessionId) return;

    let cancelled = false;
    const tick = () => {
      void fetchMentionAttachments({
        chatId: effectiveChatId,
        eveSessionId,
      })
        .then((items) => {
          if (!cancelled) {
            setLibraryAttachments(items);
            setParseDrawerAttachment((current) => {
              if (!current?.id) return current;
              const fresh = items.find((row) => row.id === current.id);
              return fresh ?? current;
            });
          }
        })
        .catch(() => {
          /* ignore poll errors */
        });
    };
    tick();
    const timer = window.setInterval(tick, ATTACHMENT_PARSE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [effectiveChatId, eveSessionId, shouldPollParse]);

  const selectMention = useCallback(
    (option: MentionAttachmentOption) => {
      const el = textareaRef.current;
      if (!el || !mention) return;
      explicitMentionPicksRef.current = [
        ...explicitMentionPicksRef.current.filter((p) => p.id !== option.id),
        option,
      ];
      const cursor = el.selectionStart ?? text.length;
      const { nextText, nextCursor } = insertMentionFilename(
        text,
        mention,
        cursor,
        option.filename,
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
        setLibraryAttachments((prev) => {
          const without = prev.filter((row) => row.id !== saved.id);
          return [saved, ...without];
        });
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
      if (persistAttachments && !(chatId || eveSessionId)) return;
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
    [
      attachments,
      canUpload,
      chatId,
      disabled,
      eveSessionId,
      persistAttachments,
      resuming,
      uploadOne,
    ],
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

    const uploadErrors = attachments.filter((item) => item.uploadState === "error");
    if (uploadErrors.length > 0) {
      setAttachmentError(
        uploadErrors[0]?.uploadError ?? "One or more attachments failed to upload.",
      );
      return;
    }

    const stagedIds = attachments
      .map((item) => item.platformId)
      .filter((id): id is string => Boolean(id));
    const mentionSplit = mergeExplicitMentionIds(
      parseDocumentMentionIds(value, mentionOptions),
      explicitMentionPicksRef.current,
    );
    const attachmentIds = mergeAttachmentIdsForSend(
      stagedIds,
      mentionSplit.attachmentIds,
    );
    const importIds = workspaceImports.map((f) => f.id);
    const workspaceFileIds = [
      ...new Set([...importIds, ...mentionSplit.workspaceFileIds]),
    ];

    if (attachmentIds.length > ATTACHMENT_LIMITS.maxFilesPerMessage) {
      setAttachmentError(
        `At most ${ATTACHMENT_LIMITS.maxFilesPerMessage} attachments per message.`,
      );
      return;
    }

    for (const attachmentId of attachmentIds) {
      const row = libraryAttachments.find((item) => item.id === attachmentId);
      if (!row) {
        setAttachmentError("Referenced attachment was not found in this chat.");
        return;
      }
      if (!isAttachmentReadyForSend(row)) {
        const inProgress = attachmentParseInProgress(row);
        setAttachmentError(
          inProgress
            ? `${row.filename} is still parsing. Wait for parse to finish before sending.`
            : `${row.filename} could not be parsed. Remove it or retry parse before sending.`,
        );
        return;
      }
    }

    for (const fileId of workspaceFileIds) {
      const file = [...sessionWorkspaceFiles, ...workspaceImports].find(
        (row) => row.id === fileId,
      );
      if (!file) {
        setAttachmentError("Referenced workspace file was not found.");
        return;
      }
      const row = workspaceFileAsAttachmentRow(file);
      if (!isAttachmentReadyForSend(row)) {
        const inProgress = attachmentParseInProgress(row);
        setAttachmentError(
          inProgress
            ? `${file.filename} is still parsing. Wait before sending.`
            : `${file.filename} could not be parsed. Remove it before sending.`,
        );
        return;
      }
    }

    const docsAwaitingUpload = attachments.filter(
      (item) => !isImageMime(item.mediaType) && !item.platformId,
    );
    if (docsAwaitingUpload.length > 0 && !canUpload) {
      setAttachmentError(
        "Start the chat session before sending document attachments.",
      );
      return;
    }

    const workspaceFiles = workspaceFileIds
      .map((id) =>
        [...sessionWorkspaceFiles, ...workspaceImports].find(
          (row) => row.id === id,
        ),
      )
      .filter((row): row is WorkspaceFilePublic => Boolean(row));

    await onSend({
      text: value,
      attachments,
      attachmentIds,
      workspaceFileIds,
      workspaceFiles,
    });
    setText("");
    setAttachments([]);
    setWorkspaceImports([]);
    explicitMentionPicksRef.current = [];
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
        if (picked) selectMention(picked);
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
  const hasSendable =
    (hasDraft || attachments.length > 0 || workspaceImports.length > 0) &&
    !sendBlockedByParse;
  const showStop = busy && !hasDraft && attachments.length === 0 && !resuming;
  const inputLocked = disabled || resuming || preparingAttachments;
  const attachNeedsSession =
    persistAttachments && !(chatId || eveSessionId);
  const attachDisabled =
    inputLocked ||
    attachNeedsSession ||
    attachments.length >= ATTACHMENT_LIMITS.maxFilesPerMessage;
  const attachButtonTitle = attachNeedsSession
    ? "Send a message first to attach files"
    : "Attach file";

  return (
    <form
      className="composer"
      onSubmit={submit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {audioDraft.transcriptToolbar}
      <div className="composer-box">
        {audioDraft.draftCard}
        {audioDraft.error ? (
          <p className="audio-capture-error" role="alert">
            {audioDraft.error}
          </p>
        ) : null}
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
          libraryById={libraryById}
          canUpload={Boolean(canUpload)}
          onRemove={removeAttachment}
          onChipClick={(row) => setParseDrawerAttachment(row)}
        />
        <ComposerWorkspaceChips
          files={workspaceImports}
          onRemove={(id) =>
            setWorkspaceImports((prev) => prev.filter((f) => f.id !== id))
          }
        />
        <ComposerWorkspaceImportModal
          open={workspaceImportOpen}
          onClose={() => setWorkspaceImportOpen(false)}
          alreadyImportedIds={new Set(workspaceImports.map((f) => f.id))}
          onImport={(picked) => {
            setWorkspaceImports((prev) => {
              const byId = new Map(prev.map((f) => [f.id, f]));
              for (const file of picked) byId.set(file.id, file);
              return [...byId.values()];
            });
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
              title={attachButtonTitle}
              aria-label={attachButtonTitle}
              disabled={attachDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="composer-icon-btn"
              title="Import from Workspace"
              aria-label="Import from Workspace"
              disabled={inputLocked}
              onClick={() => setWorkspaceImportOpen(true)}
            >
              <FolderOpen size={18} strokeWidth={2} />
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
