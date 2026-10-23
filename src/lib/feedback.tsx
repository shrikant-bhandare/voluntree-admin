"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { Dialog } from "../components/ui/Overlay";
import { Button, Label, TextArea, cn } from "../components/ui/primitives";

/* ------------------------------------------------------------------ Toasts */

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** e.g. Undo. The toast closes when it is pressed. */
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

/* ----------------------------------------------------------------- Confirm */

export interface ConfirmInput {
  title: string;
  /** What will happen, in plain language. */
  body: ReactNode;
  confirmLabel: string;
  /** Defaults to "Cancel"; set it when the action itself says "Cancel …". */
  cancelLabel?: string;
  tone?: "default" | "danger" | "positive";
  /** Ask for a written reason before confirming. */
  note?: {
    label: string;
    placeholder?: string;
    /** Required when > 0. */
    minLength?: number;
    hint?: string;
  };
}

export interface ConfirmResult {
  confirmed: boolean;
  note: string;
}

interface FeedbackValue {
  toast: (t: ToastInput) => void;
  confirm: (c: ConfirmInput) => Promise<ConfirmResult>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const TOAST_ICON = { success: CheckCircle2, error: CircleAlert, info: Info };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setToasts(prev => [...prev.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.action ? 8000 : 5000);
    },
    [dismiss]
  );

  const [pending, setPending] = useState<ConfirmInput | null>(null);
  const [note, setNote] = useState("");
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null);
  const noteId = useId();

  const confirm = useCallback((c: ConfirmInput) => {
    setNote("");
    setPending(c);
    return new Promise<ConfirmResult>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (confirmed: boolean) => {
    resolver.current?.({ confirmed, note: note.trim() });
    resolver.current = null;
    setPending(null);
  };

  const minLength = pending?.note?.minLength ?? 0;
  const noteTooShort = Boolean(pending?.note) && note.trim().length < minLength;

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <Dialog
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        tone={pending?.tone === "danger" ? "danger" : "default"}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={pending?.tone === "danger" ? "danger" : pending?.tone === "positive" ? "positive" : "primary"}
              disabled={noteTooShort}
              onClick={() => settle(true)}
              data-autofocus={pending?.note ? undefined : true}
            >
              {pending?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-3">{pending?.body}</div>
        {pending?.note ? (
          <div className="mt-4">
            <Label htmlFor={noteId} hint={minLength > 0 ? "(required)" : "(optional)"}>
              {pending.note.label}
            </Label>
            <TextArea
              id={noteId}
              data-autofocus
              value={note}
              maxLength={500}
              placeholder={pending.note.placeholder}
              onChange={e => setNote(e.target.value)}
            />
            <p className="mt-1.5 flex justify-between text-label text-ink-3">
              <span>{pending.note.hint ?? "Recorded in the audit log."}</span>
              <span className="tabular">{note.length}/500</span>
            </p>
          </div>
        ) : null}
      </Dialog>

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:items-end sm:p-0"
      >
        {toasts.map(t => {
          const tone = t.tone ?? "success";
          const Icon = TOAST_ICON[tone];
          return (
            <div
              key={t.id}
              role={tone === "error" ? "alert" : "status"}
              className="enter-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-forest px-4 py-3 text-white shadow-overlay"
            >
              <Icon
                aria-hidden
                className={cn("mt-0.5 size-5 shrink-0", tone === "error" ? "text-danger-soft" : "text-mint")}
              />
              <div className="min-w-0 flex-1">
                <p className="text-meta font-semibold">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-meta text-forest-200">{t.description}</p> : null}
              </div>
              {t.action ? (
                <button
                  type="button"
                  className="shrink-0 rounded-sm px-1 text-meta font-semibold text-mint underline-offset-4 hover:underline"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss"
                className="-mr-1 shrink-0 rounded-sm p-0.5 text-forest-200 hover:text-white"
                onClick={() => dismiss(t.id)}
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
