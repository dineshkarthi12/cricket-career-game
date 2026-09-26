import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, FolderOpen, Gauge, HardDrive, Lightbulb, Smartphone, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card, CardHeader, ConfirmDialog, ProgressBar } from '@/components';
import { DIFFICULTY } from '@/engine/config';
import { storageUsage, type StorageUsage } from '@/save';
import { readSaveFile } from '@/save/file';
import { promptInstall, usePwa } from '@/lib/pwa';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { BALL_SPEEDS } from '@/store/matchStore';
import { useAppSettings, type AnimationSpeed } from '@/store/appSettings';
import { SAVE_SLOT_IDS, type Difficulty } from '@/types';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** A row of mutually exclusive choices, as a radio group for keyboards and screen readers. */
function Choice<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-page p-1">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn('rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40', o.id === value ? 'bg-surface text-brand-blue shadow-card' : 'text-ink-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-brand-blue" />
  );
}

const DIFFICULTIES = (Object.keys(DIFFICULTY) as Difficulty[]).map((id) => ({ id, label: DIFFICULTY[id].label }));
const ANIMATION: { id: AnimationSpeed; label: string }[] = [
  { id: 'SLOW', label: 'Slow' },
  { id: 'NORMAL', label: 'Normal' },
  { id: 'FAST', label: 'Fast' },
];

/** Saves, storage and game options. */
export default function SettingsScreen({ devTools }: { devTools?: ReactNode }) {
  const navigate = useNavigate();
  const state = useGameStore((s) => s.state);
  const slots = useGameStore((s) => s.slots);
  const slot = useGameStore((s) => s.slot);
  const update = useGameStore((s) => s.update);
  const exportCareer = useGameStore((s) => s.exportCareer);
  const importCareer = useGameStore((s) => s.importCareer);
  const deleteCareer = useGameStore((s) => s.deleteCareer);
  const saveNow = useGameStore((s) => s.saveNow);
  const pushToast = useGameStore((s) => s.pushToast);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);
  const app = useAppSettings();
  const pwa = usePwa();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [confirm, setConfirm] = useState<null | 'delete' | 'import'>(null);
  const [pending, setPending] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void storageUsage().then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, [lastSavedAt, slots]);

  const share = usage?.usage !== null && usage?.quota ? (usage.usage! / usage.quota) * 100 : null;
  const difficulty = state?.settings.difficulty ?? 'REALISTIC';

  const onPickFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    const read = await readSaveFile(file);
    if (!read.ok) {
      pushToast({ tone: 'error', message: read.error.message });
      return;
    }
    setPending(read.value);
    setConfirm('import');
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <h1 className="text-[22px] leading-tight font-bold text-ink">Settings</h1>
      {devTools}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gameplay" subtitle={state ? 'For this career' : 'Start or load a career to change these'} className="mb-1" />
          <Row title="Difficulty" hint={DIFFICULTY[difficulty].description}>
            <Choice
              label="Difficulty"
              value={difficulty}
              options={DIFFICULTIES}
              disabled={!state}
              onChange={(d) => update((s) => ({ ...s, settings: { ...s.settings, difficulty: d } }))}
            />
          </Row>
          <Row title="Commentary" hint="How much the commentator says each ball">
            <Choice
              label="Commentary detail"
              value={state?.settings.commentaryDetail ?? 'NORMAL'}
              options={[{ id: 'BRIEF', label: 'Brief' }, { id: 'NORMAL', label: 'Normal' }, { id: 'DETAILED', label: 'Detailed' }]}
              disabled={!state}
              onChange={(c) => update((s) => ({ ...s, settings: { ...s.settings, commentaryDetail: c } }))}
            />
          </Row>
        </Card>

        <Card>
          <CardHeader title="Matches and motion" subtitle="On this device" className="mb-1" />
          <Row title="Animation speed" hint="Ball flight on the ground and the auction room">
            <Choice label="Animation speed" value={app.animationSpeed} options={ANIMATION} onChange={(v) => app.set({ animationSpeed: v })} />
          </Row>
          <Row title="Default sim speed" hint="The pace a match starts at when it plays itself">
            <Choice label="Default sim speed" value={app.defaultSimSpeed} options={BALL_SPEEDS.map((s, i) => ({ id: i, label: s.label }))} onChange={(v) => app.set({ defaultSimSpeed: v })} />
          </Row>
          <Row title="Reduce motion" hint="No ball-flight or pulsing animations. Also follows your system setting.">
            <Toggle label="Reduce motion" checked={app.reduceMotion} onChange={(v) => app.set({ reduceMotion: v })} />
          </Row>
        </Card>

        <Card>
          <CardHeader title="Storage" subtitle="Careers are kept in this browser's IndexedDB" className="mb-3" />
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Database className="size-4 text-brand-blue" aria-hidden />
            {usage === null ? (
              <Badge tone="grey">Checking…</Badge>
            ) : usage.kind === 'memory' ? (
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
            {usage && share === null ? <p className="mt-1 text-[11.5px] text-ink-muted">This browser does not report its quota.</p> : null}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {SAVE_SLOT_IDS.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink">
                  <HardDrive className="size-3.5 text-ink-soft" aria-hidden />
                  Slot {id}
                  {slot === id ? <Badge tone="blue">Current</Badge> : null}
                </span>
                <span className="min-w-0 truncate text-ink-muted">{slots[id - 1]?.playerName ?? 'Empty'}</span>
                <span className="font-semibold text-ink">{formatBytes(usage?.slots[id] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-muted">Ball-by-ball detail is kept for your last two matches; older matches keep full scorecards.</p>
        </Card>

        <Card>
          <CardHeader title="Saves" className="mb-1" />
          <Row title="Autosave" hint="Saves after every week and every match">
            <Toggle label="Autosave" checked={state?.settings.autosave ?? true} disabled={!state} onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, autosave: v } }))} />
          </Row>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!state} onClick={() => saveNow()} className="rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
              Save now
            </button>
            <button type="button" disabled={!state} onClick={() => exportCareer() && pushToast({ tone: 'success', message: 'Save file downloaded.' })} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40">
              <Download className="size-3.5" aria-hidden />
              Export
            </button>
            <button type="button" disabled={slot === null} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40">
              <Upload className="size-3.5" aria-hidden />
              Import
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Import a save file into this slot" onChange={(e) => void onPickFile(e.target.files?.[0])} />
            <Link to="/slots" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink">
              <FolderOpen className="size-3.5" aria-hidden />
              Manage slots
            </Link>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <button type="button" disabled={slot === null} onClick={() => setConfirm('delete')} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-red/40 px-3.5 py-2 text-[12.5px] font-semibold text-brand-red hover:bg-brand-red/5 disabled:opacity-40">
              <Trash2 className="size-3.5" aria-hidden />
              Delete this career
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Tutorial" className="mb-1" />
          <Row title="Tips" hint={`${app.tipsSeen.length ? `${app.tipsSeen.length} tip${app.tipsSeen.length === 1 ? '' : 's'} dismissed.` : 'All tips will show.'} Tips appear on the dashboard, training, matches and selection.`}>
            <button
              type="button"
              onClick={() => {
                app.resetTutorial();
                pushToast({ tone: 'info', message: 'The tutorial tips will show again.' });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
            >
              <Lightbulb className="size-3.5" aria-hidden />
              Reset tutorial
            </button>
          </Row>
        </Card>

        <Card>
          <CardHeader title="Install the app" subtitle="Play from your home screen, even offline" className="mb-1" />
          {pwa.installed ? (
            <p className="flex items-center gap-2 py-2 text-[13px] text-ink"><Smartphone className="size-4 text-brand-green" aria-hidden /> Installed on this device.</p>
          ) : pwa.canInstall ? (
            <Row title="Add Cricket Career to this device" hint="It opens in its own window and works without a connection.">
              <button type="button" onClick={() => void promptInstall()} className="rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white">
                Install app
              </button>
            </Row>
          ) : pwa.iosManual ? (
            <p className="py-2 text-[13px] text-ink">On iPhone and iPad: tap <span className="font-semibold">Share</span> in Safari, then <span className="font-semibold">Add to Home Screen</span>.</p>
          ) : (
            <p className="py-2 text-[13px] text-ink-muted">Use your browser's menu (Install app, or Add to Home screen). Once opened, the game is cached for offline play.</p>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title="Delete this career?"
        message={`${state ? `${state.player.firstName} ${state.player.lastName}'s` : 'This'} career in slot ${slot ?? ''} will be deleted from this browser. Export it first if you might want it back.`}
        confirmLabel="Delete career"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (slot !== null && deleteCareer(slot)) {
            pushToast({ tone: 'success', message: 'Career deleted.' });
            navigate('/slots');
          }
        }}
      />
      <ConfirmDialog
        open={confirm === 'import'}
        danger
        title="Replace this career?"
        message={`The save file will replace what is in slot ${slot ?? ''}. Export the current career first if you want to keep it.`}
        confirmLabel="Import and replace"
        onCancel={() => {
          setConfirm(null);
          setPending(null);
        }}
        onConfirm={() => {
          setConfirm(null);
          if (pending && slot !== null && importCareer(pending, slot)) pushToast({ tone: 'success', message: 'Save imported.' });
          setPending(null);
        }}
      />
      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-muted"><Gauge className="size-3.5" aria-hidden /> Difficulty changes apply from the next selection meeting and match.</p>
    </div>
  );
}
