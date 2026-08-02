import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/**
 * Toasts replace `alert()` and inline banners for transient feedback.
 *
 * They stack bottom-up on phones (clear of the tab bar) and bottom-right on
 * desktop, auto-dismiss, and pause nothing — anything the user must act on
 * belongs in the page, not in a toast.
 */
const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, ring: 'ring-success-border', accent: 'text-success' },
  error: { icon: XCircle, ring: 'ring-danger-border', accent: 'text-danger' },
  warning: { icon: AlertTriangle, ring: 'ring-warning/40', accent: 'text-warning' },
  info: { icon: Info, ring: 'ring-border', accent: 'text-primary' },
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++nextId;
      const duration = toast.duration ?? (toast.tone === 'error' ? 7000 : 4500);
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      toast: push,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'error', title, description }),
      warning: (title, description) => push({ tone: 'warning', title, description }),
      info: (title, description) => push({ tone: 'info', title, description }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // polite: a toast is confirmation, never the only route to information.
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end sm:pb-4"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone ?? 'info'];
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={`animate-toast-in pointer-events-auto flex w-full max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl bg-elevated p-3.5 shadow-lg ring-1 ${tone.ring}`}
            >
              <Icon className={`mt-px h-5 w-5 shrink-0 ${tone.accent}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug font-semibold text-ink">{toast.title}</p>
                {toast.description && (
                  <p className="text-help mt-0.5 text-ink-3">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-m-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
