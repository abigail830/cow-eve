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
};

export function ResizableAside({
  children,
  defaultWidth = 400,
  minWidth = 280,
  maxWidthRatio = 0.75,
  className = "",
  hidden,
}: Props) {
  const [width, setWidth] = useState(defaultWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

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
      const maxWidth = Math.min(1200, window.innerWidth * maxWidthRatio);
      const delta = dragRef.current.startX - event.clientX;
      const next = Math.min(
        maxWidth,
        Math.max(minWidth, dragRef.current.startWidth + delta),
      );
      setWidth(next);
    },
    [minWidth, maxWidthRatio],
  );

  return (
    <div
      className={`resizable-aside${className ? ` ${className}` : ""}`}
      style={{ width }}
      hidden={hidden}
      aria-hidden={hidden}
    >
      <div
        className="resizable-aside-handle"
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
