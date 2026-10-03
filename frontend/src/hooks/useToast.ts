import { useEffect, useState } from "react";

export type ToastKind = "success" | "error";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

const listeners = new Set<(stack: ToastItem[]) => void>();
let stack: ToastItem[] = [];
let nextId = 0;

function emit() {
  const snapshot = [...stack];
  for (const listener of listeners) listener(snapshot);
}

export function showToast(
  kind: ToastKind,
  message: string,
  durationMs = kind === "error" ? 7000 : 4000,
) {
  const id = ++nextId;
  stack = [...stack, { id, kind, message }];
  emit();
  window.setTimeout(() => {
    stack = stack.filter((item) => item.id !== id);
    emit();
  }, durationMs);
}

export function useToastStack(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>(() => [...stack]);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return items;
}
