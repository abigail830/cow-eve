import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import "./ResizableAside.css";

type Props = {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidthRatio?: number;
  className?: string;
  hidden?: boolean;
  /** When false, hide the default divider line (handle stays draggable). */
  showHandleDivider?: boolean;
  /**
   * "overlap" extends the handle slightly left (default).
   * "inside" keeps the hit target within the panel (better when parent uses overflow:hidden).
   */
  handlePlacement?: "overlap" | "inside";
  /** Leading = handle on the left (right-side panels). Trailing = handle on the right (left-side panels). */
  handleSide?: "leading" | "trailing";
  /** When set, last dragged width is restored from localStorage. */
  persistKey?: string;
  /** Initial width as a fraction of viewport when nothing is persisted (overrides defaultWidth). */
  defaultWidthRatio?: number;
};

function clampWidth(
  width: number,
  minWidth: number,
  maxWidthRatio: number,
): number {
  const maxWidth = Math.min(1200, window.innerWidth * maxWidthRatio);
  return Math.min(maxWidth, Math.max(minWidth, width));
}

function readPersistedWidth(
  key: string,
  minWidth: number,
  maxWidthRatio: number,
): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return null;
    return clampWidth(parsed, minWidth, maxWidthRatio);
  } catch {
    return null;
  }
}

function resolveInitialWidth(input: {
  defaultWidth: number;
  defaultWidthRatio?: number;
  minWidth: number;
  maxWidthRatio: number;
  persistKey?: string;
}): number {
  if (input.persistKey) {
    const saved = readPersistedWidth(
      input.persistKey,
      input.minWidth,
      input.maxWidthRatio,
    );
    if (saved !== null) return saved;
  }
  if (input.defaultWidthRatio != null && input.defaultWidthRatio > 0) {
    return clampWidth(
      Math.round(window.innerWidth * input.defaultWidthRatio),
      input.minWidth,
      input.maxWidthRatio,
    );
  }
  return clampWidth(input.defaultWidth, input.minWidth, input.maxWidthRatio);
}

export function ResizableAside({
  children,
  defaultWidth = 400,
  minWidth = 280,
  maxWidthRatio = 0.75,
  className = "",
  hidden,
  showHandleDivider = true,
  handlePlacement = "overlap",
  handleSide = "leading",
  persistKey,
  defaultWidthRatio,
}: Props) {
  const [width, setWidth] = useState(() =>
    resolveInitialWidth({
      defaultWidth,
      defaultWidthRatio,
      minWidth,
      maxWidthRatio,
      persistKey,
    }),
  );
  const widthRef = useRef(width);
  widthRef.current = width;
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const persistWidth = useCallback(
    (next: number) => {
      if (!persistKey) return;
      try {
        localStorage.setItem(persistKey, String(Math.round(next)));
      } catch {
        /* ignore quota / private mode */
      }
    },
    [persistKey],
  );

  const endDrag = useCallback(() => {
    if (dragRef.current && persistKey) {
      persistWidth(widthRef.current);
    }
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [persistKey, persistWidth]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (window.matchMedia("(max-width: 768px)").matches) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const delta =
        handleSide === "trailing"
          ? event.clientX - dragRef.current.startX
          : dragRef.current.startX - event.clientX;
      const next = clampWidth(
        dragRef.current.startWidth + delta,
        minWidth,
        maxWidthRatio,
      );
      setWidth(next);
    },
    [handleSide, minWidth, maxWidthRatio],
  );

  return (
    <div
      className={`resizable-aside${className ? ` ${className}` : ""}`}
      style={{ width }}
      hidden={hidden}
      aria-hidden={hidden}
    >
      <div
        className={[
          "resizable-aside-handle",
          showHandleDivider ? "" : "resizable-aside-handle-plain",
          handlePlacement === "inside" ? "resizable-aside-handle-inside" : "",
          handleSide === "trailing" ? "resizable-aside-handle-trailing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-label="Resize panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="resizable-aside-content">{children}</div>
    </div>
  );
}
