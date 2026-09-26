import { useEffect, useRef, useState } from 'react';
import { Download, Play, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Card, StatTile } from '@/components';
import { EntryLayout } from './entry/EntryLayout';
import { useGameStore } from '@/store/gameStore';
import { readSaveFile } from '@/save/file';
import { formatLongDate, formatTimestamp } from '@/lib/format';
import { SAVE_SLOT_IDS, type SaveMeta, type SaveSlotId } from '@/types';

/**
 * The three save slots: continue a career, start a new one, or bring one in
 * from a file. Everything here goes through the Phase 1 save system, so a
 * failed write surfaces as a message rather than an exception.
 */
export default function SlotPicker() {
  const navigate = useNavigate();
  const slots = useGameStore((s) => s.slots);
  const activeSlot = useGameStore((s) => s.slot);
  const lastError = useGameStore((s) => s.lastError);
  const refreshSlots = useGameStore((s) => s.refreshSlots);
  const loadCareer = useGameStore((s) => s.loadCareer);
  const clearError = useGameStore((s) => s.clearError);

  const [confirmingDelete, setConfirmingDelete] = useState<SaveSlotId | null>(null);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const onContinue = (slot: SaveSlotId) => {
    if (loadCareer(slot)) navigate('/');
  };

  return (
    <EntryLayout
      title="Your careers"
      subtitle="Three slots. Pick one up where you left it, or start again from the very bottom — nothing is handed out."
    >
      {lastError ? (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3"
        >
          <p className="text-[13.5px] text-ink">{lastError.message}</p>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 text-[12.5px] font-semibold text-brand-red"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {SAVE_SLOT_IDS.map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            meta={slots[slot - 1]}
            isActive={activeSlot === slot}
            confirmingDelete={confirmingDelete === slot}
            onConfirmDelete={() => setConfirmingDelete(slot)}
            onCancelDelete={() => setConfirmingDelete(null)}
            onContinue={() => onContinue(slot)}
            onNew={() => navigate(`/new?slot=${slot}`)}
          />
        ))}
      </div>
    </EntryLayout>
  );
}

interface SlotCardProps {
  slot: SaveSlotId;
  meta: SaveMeta | null;
  isActive: boolean;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onContinue: () => void;
  onNew: () => void;
}

function SlotCard({
  slot,
  meta,
  isActive,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onContinue,
  onNew,
}: SlotCardProps) {
  const deleteCareer = useGameStore((s) => s.deleteCareer);
  const exportSlot = useGameStore((s) => s.exportSlot);
  const importCareer = useGameStore((s) => s.importCareer);
  const pushToast = useGameStore((s) => s.pushToast);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    const read = await readSaveFile(file);
    if (read.ok) importCareer(read.value, slot);
    else pushToast({ tone: 'error', message: read.error.message });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <Card className="flex flex-col">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
          Slot {slot}
        </h2>
        {isActive ? <Badge tone="blue">Current</Badge> : null}
      </header>

      {meta ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={meta.playerName} size={44} decorative />
            <div className="min-w-0">
              <p className="truncate text-[16px] leading-tight font-semibold text-ink">
                {meta.playerName}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{meta.teamName}</p>
            </div>
          </div>

          <p className="mt-3">
            <Badge tone="grey">{meta.stageLabel}</Badge>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <StatTile label="Age" value={meta.age} />
            <StatTile label="OVR" value={meta.overall} />
            <StatTile label="Matches" value={meta.matchesPlayed} />
            <StatTile label="Runs" value={meta.runs} />
          </div>

          <dl className="mt-3 space-y-1 text-[12px] text-ink-muted">
            <div className="flex justify-between gap-2">
              <dt>Season</dt>
              <dd className="font-medium text-ink">{meta.seasonLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>In-game date</dt>
              <dd className="font-medium text-ink">{formatLongDate(meta.inGameDate)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last saved</dt>
              <dd className="font-medium text-ink">{formatTimestamp(meta.savedAt)}</dd>
            </div>
          </dl>

          <div className="mt-auto pt-4">
            {confirmingDelete ? (
              <div className="rounded-tile bg-brand-red/8 p-3">
                <p className="text-[12.5px] text-ink">
                  Delete {meta.playerName}&apos;s career? This cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      deleteCareer(slot);
                      onCancelDelete();
                    }}
                    className="flex-1 rounded-lg bg-brand-red px-3 py-2 text-[12.5px] font-semibold text-white"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={onCancelDelete}
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onContinue}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
                >
                  <Play className="size-4 fill-white" aria-hidden />
                  Continue career
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportSlot(slot)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-page"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmDelete}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-brand-red transition-colors hover:bg-brand-red/8"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center rounded-tile border border-dashed border-line py-8 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-page text-ink-soft" aria-hidden>
              <Plus className="size-5" />
            </span>
            <p className="mt-2.5 text-[13.5px] font-medium text-ink">Empty slot</p>
            <p className="mt-1 max-w-[190px] text-[12px] text-ink-soft">
              Every career starts as a beginner at a club ground.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={onNew}
              className="rounded-xl bg-brand-blue px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
            >
              Start new career
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-page"
            >
              <Upload className="size-3.5" aria-hidden />
              Import a save file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label={`Import a save file into slot ${slot}`}
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
