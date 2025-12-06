'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'error';

export interface ShowToastOptions {
  duration?: number; // ms; 0 = persist until dismissed
}

export interface ToastHandle {
  id: string;
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  show: (type: ToastType, message: string, options?: ShowToastOptions) => ToastHandle;
  dismiss: (id: string) => void;
  info: (message: string, options?: ShowToastOptions) => ToastHandle;
  success: (message: string, options?: ShowToastOptions) => ToastHandle;
  error: (message: string, options?: ShowToastOptions) => ToastHandle;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastContainer({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-white border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-[360px]"
          role="status"
          aria-live="polite"
        >
          {t.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-600 mt-0.5 animate-spin" />
          )}
          <div className="text-sm text-foreground flex-1">{t.message}</div>
          <button
            aria-label="Close"
            className="text-muted-foreground/70 hover:text-foreground transition"
            onClick={() => onClose(t.id)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((type: ToastType, message: string, options?: ShowToastOptions): ToastHandle => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const duration = options?.duration ?? (type === 'info' ? 0 : 4000);
    const item: ToastItem = { id, type, message, duration };
    setToasts((prev) => [...prev, item]);
    if (duration && duration > 0) {
      const t = window.setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.current.set(id, t);
    }
    return { id };
  }, [dismiss]);

  const api = useMemo<ToastContextValue>(() => ({
    show,
    dismiss,
    info: (message, options) => show('info', message, options),
    success: (message, options) => show('success', message, options),
    error: (message, options) => show('error', message, options),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
