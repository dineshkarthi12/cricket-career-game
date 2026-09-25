import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useGameStore, type Toast } from '@/store/gameStore';

const TONE: Record<Toast['tone'], { icon: typeof Info; box: string; iconClass: string }> = {
  error: { icon: AlertTriangle, box: 'border-brand-red/30', iconClass: 'text-brand-red' },
  info: { icon: Info, box: 'border-brand-blue/25', iconClass: 'text-brand-blue' },
  success: { icon: CheckCircle2, box: 'border-brand-green/30', iconClass: 'text-brand-green' },
};

/**
 * Toasts in the corner of every screen. Errors stay until dismissed - a
 * failed save must be seen - everything else fades after a few seconds.
 */
export function ToastHost() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    const timers = toasts
      .filter((t) => t.tone !== 'error')
      .map((t) => setTimeout(() => dismiss(t.id), 5000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-3 bottom-20 z-50 flex w-[min(360px,calc(100vw-24px))] flex-col gap-2 md:bottom-4">
      {toasts.map((toast) => {
        const tone = TONE[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex items-start gap-2.5 rounded-card border bg-surface px-3.5 py-3 shadow-card', tone.box)}
          >
            <tone.icon className={cn('mt-0.5 size-4 shrink-0', tone.iconClass)} aria-hidden />
            <p className="flex-1 text-[13px] text-ink">{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss" className="text-ink-soft hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
