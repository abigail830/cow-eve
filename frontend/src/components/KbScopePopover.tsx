import { useEffect, useId, useRef, useState } from "react";
import { Database } from "lucide-react";
import { useKbScope } from "../hooks/useKbScope";
import { KbScopeList } from "./KbScopeList";
import "./KbScopePopover.css";

type Props = {
  agentId: string;
  projectId?: string | null;
  disabled?: boolean;
};

export function KbScopePopover({
  agentId,
  projectId = null,
  disabled = false,
}: Props) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const kb = useKbScope({ agentId, projectId, active: true });

  useEffect(() => {
    if (!open) return;
    void kb.load();
  }, [open, kb.load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = open || kb.scopeActive;

  return (
    <div ref={rootRef} className="kb-scope-popover-root">
      <button
        type="button"
        className={`composer-icon-btn${active ? " composer-icon-btn-active" : ""}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-label="Knowledge bases"
        title="Knowledge bases"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Database size={18} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          className="kb-scope-popover"
          role="dialog"
          aria-label="Knowledge base scope"
        >
          <KbScopeList
            variant="popover"
            loading={kb.loading}
            saving={kb.saving}
            error={kb.error}
            connected={kb.connected}
            message={kb.message}
            items={kb.items}
            onToggle={kb.toggleOne}
            onSetAll={kb.setAll}
          />
        </div>
      ) : null}
    </div>
  );
}
