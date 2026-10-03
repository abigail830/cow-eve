import { useToastStack } from "../hooks/useToast";
import "./ToastHost.css";

export function ToastHost() {
  const toasts = useToastStack();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            toast.kind === "success" ? "toast toast-success" : "toast toast-error"
          }
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
