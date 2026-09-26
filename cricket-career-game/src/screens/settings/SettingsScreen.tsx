import { useEffect, useState } from 'react';
import { Database, Download, FolderOpen, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar } from '@/components';
import { storageUsage, type StorageUsage } from '@/save';
import { useGameStore } from '@/store/gameStore';
import { SAVE_SLOT_IDS } from '@/types';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Saves, storage and game options. */
export default function SettingsScreen({ devTools }: { devTools?: React.ReactNode }) {
  const state = useGameStore((s) => s.state);
  const slots = useGameStore((s) => s.slots);
  const slot = useGameStore((s) => s.slot);
  const update = useGameStore((s) => s.update);
  const exportCareer = useGameStore((s) => s.exportCareer);
  const saveNow = useGameStore((s) => s.saveNow);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    let live = true;
    void storageUsage().then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, [lastSavedAt, slots]);

  const share = usage?.usage !== null && usage?.quota ? (usage.usage! / usage.quota) * 100 : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <h1 className="text-[22px] leading-tight font-bold text-ink">Settings</h1>
      {devTools}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Storage" subtitle="Careers are kept in this browser's IndexedDB" className="mb-3" />
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Database className="size-4 text-brand-blue" aria-hidden />
            {usage?.kind === 'memory' ? (
              <Badge tone="red">Not persistent - IndexedDB is blocked; export your save</Badge>
            ) : (
              <Badge tone="green">IndexedDB</Badge>
            )}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12.5px]">
              <span className="text-ink-muted">Used by this game</span>
              <span className="font-semibold text-ink">
                {formatBytes(usage?.usage ?? null)} of {formatBytes(usage?.quota ?? null)}
              </span>
            </div>
            <ProgressBar value={share ?? 0} tone={share !== null && share > 80 ? 'red' : 'blue'} label="Storage used" />
            {share === null ? <p className="mt-1 text-[11.5px] text-ink-soft">This browser does not report its quota.</p> : null}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {SAVE_SLOT_IDS.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink">
                  <HardDrive className="size-3.5 text-ink-soft" aria-hidden />
                  Slot {id}
                  {slot === id ? <Badge tone="blue">Current</Badge> : null}
                </span>
                <span className="text-ink-muted">{slots[id - 1]?.playerName ?? 'Empty'}</span>
                <span className="font-semibold text-ink">{formatBytes(usage?.slots[id] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-soft">
            Ball-by-ball detail is kept for your last two matches; older matches keep full scorecards.
          </p>
        </Card>

        <Card>
          <CardHeader title="Saves" className="mb-3" />
          <label className="flex items-center justify-between gap-3 py-1.5 text-[13px] text-ink">
            <span>Autosave</span>
            <input
              type="checkbox"
              checked={state?.settings.autosave ?? true}
              disabled={!state}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, autosave: e.target.checked } }))}
              className="size-4 accent-brand-blue"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!state} onClick={() => saveNow()} className="rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
              Save now
            </button>
            <button type="button" disabled={!state} onClick={() => exportCareer()} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40">
              <Download className="size-3.5" aria-hidden />
              Export
            </button>
            <Link to="/slots" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink">
              <FolderOpen className="size-3.5" aria-hidden />
              Manage slots
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
