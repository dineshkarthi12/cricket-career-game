import { Modal } from './Modal';
import { cn } from '@/lib/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What happens, in a sentence or two. */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Irreversible actions get the red button. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" for anything that cannot be taken back. Cancel is focused first. */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} subtitle={danger ? 'This cannot be undone.' : undefined}>
      <p className="text-[13.5px] text-ink">{message}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-page">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn('rounded-xl px-4 py-2 text-[13px] font-semibold text-white', danger ? 'bg-brand-red hover:bg-brand-red/90' : 'bg-brand-blue hover:bg-brand-blue/90')}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
