import { useT } from '@/i18n/react';
import { t as tFor, type Key } from '@/i18n/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, FolderOpen, Gauge, HardDrive, Lightbulb, Smartphone, Trash2, Upload, Volume2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card, CardHeader, ConfirmDialog, ProgressBar } from '@/components';
import { DIFFICULTY } from '@/engine/config';
import { storageUsage, type StorageUsage } from '@/save';
import { readSaveFile } from '@/save/file';
import { promptInstall, usePwa } from '@/lib/pwa';
import { playSfx, unlockAudio } from '@/lib/audio/player';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { BALL_SPEEDS } from '@/store/matchStore';
import { useAppSettings, type AnimationSpeed } from '@/store/appSettings';
import { SAVE_SLOT_IDS, type Difficulty } from '@/types';
import { RoleCard } from './RoleCard';

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

const DIFFICULTIES = Object.keys(DIFFICULTY) as Difficulty[];
const ANIMATION: { id: AnimationSpeed; key: Key }[] = [
  { id: 'SLOW', key: 'settings.slow' },
  { id: 'NORMAL', key: 'settings.normal' },
  { id: 'FAST', key: 'settings.fast' },
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
  const t = useT();

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
      <h1 className="text-[22px] leading-tight font-bold text-ink">{t('settings.title')}</h1>
      {devTools}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('settings.language')} subtitle={t('settings.onDevice')} className="mb-1" />
          <Row title={t('settings.language')} hint={t('settings.languageHint')}>
            <Choice
              label={t('settings.language')}
              value={app.language}
              options={[
                { id: 'en', label: t('settings.languageEn') },
                { id: 'ta', label: t('settings.languageTa') },
              ]}
              onChange={(language) => {
                app.set({ language });
                pushToast({ tone: 'success', message: tFor(language, 'toast.languageSet') });
              }}
            />
          </Row>
        </Card>
        <Card>
          <CardHeader title={t('settings.gameplay')} subtitle={state ? t('settings.forCareer') : t('settings.noCareer')} className="mb-1" />
          <Row title={t('settings.difficulty')} hint={t(`difficulty.${difficulty}.desc` as Key)}>
            <Choice
              label={t('settings.difficulty')}
              value={difficulty}
              options={DIFFICULTIES.map((id) => ({ id, label: t(`difficulty.${id}` as Key) }))}
              disabled={!state}
              onChange={(d) => update((s) => ({ ...s, settings: { ...s.settings, difficulty: d } }))}
            />
          </Row>
          <Row title={t('settings.commentary')} hint={t('settings.commentaryHint')}>
            <Choice
              label={t('settings.commentaryDetail')}
              value={state?.settings.commentaryDetail ?? 'NORMAL'}
              options={[{ id: 'BRIEF', label: t('settings.brief') }, { id: 'NORMAL', label: t('settings.normal') }, { id: 'DETAILED', label: t('settings.detailed') }]}
              disabled={!state}
              onChange={(c) => update((s) => ({ ...s, settings: { ...s.settings, commentaryDetail: c } }))}
            />
          </Row>
        </Card>

        <RoleCard />

        <Card>
          <CardHeader title={t('settings.motion')} subtitle={t('settings.onDevice')} className="mb-1" />
          <Row title={t('settings.animation')} hint={t('settings.animationHint')}>
            <Choice label={t('settings.animation')} value={app.animationSpeed} options={ANIMATION.map((a) => ({ id: a.id, label: t(a.key) }))} onChange={(v) => app.set({ animationSpeed: v })} />
          </Row>
          <Row title={t('settings.simSpeed')} hint={t('settings.simSpeedHint')}>
            <Choice label={t('settings.simSpeed')} value={app.defaultSimSpeed} options={BALL_SPEEDS.map((_, i) => ({ id: i, label: t(`speed.${i}` as Key) }))} onChange={(v) => app.set({ defaultSimSpeed: v })} />
          </Row>
          <Row title={t('settings.reduceMotion')} hint={t('settings.reduceMotionHint')}>
            <Toggle label={t('settings.reduceMotion')} checked={app.reduceMotion} onChange={(v) => app.set({ reduceMotion: v })} />
          </Row>
        </Card>

        <Card>
          <CardHeader title={t('settings.sound')} subtitle={t('settings.soundHint')} className="mb-1" />
          <Row title={t('settings.effects')} hint={t('settings.effectsHint')}>
            <Toggle label={t('settings.effects')} checked={app.soundEffects} onChange={(v) => app.set({ soundEffects: v })} />
          </Row>
          <Row title={t('settings.crowd')} hint={t('settings.crowdHint')}>
            <Toggle label={t('settings.crowd')} checked={app.crowdAmbience} disabled={!app.soundEffects} onChange={(v) => app.set({ crowdAmbience: v })} />
          </Row>
          <Row title={t('settings.clicks')} hint={t('settings.clicksHint')}>
            <Toggle label={t('settings.clicks')} checked={app.buttonClicks} disabled={!app.soundEffects} onChange={(v) => app.set({ buttonClicks: v })} />
          </Row>
          <Row title={t('settings.volume')} hint={`${Math.round(app.volume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(app.volume * 100)}
              aria-label={t('settings.volume')}
              onChange={(e) => app.set({ volume: Number(e.target.value) / 100 })}
              className="w-40 accent-brand-blue"
            />
          </Row>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              playSfx(['BAT_BIG', 'ROAR']);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
          >
            <Volume2 className="size-3.5" aria-hidden />
            {t('settings.testSound')}
          </button>
        </Card>

        <Card>
          <CardHeader title={t('settings.storage')} subtitle={t('settings.storageHint')} className="mb-3" />
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <Database className="size-4 text-brand-blue" aria-hidden />
            {usage === null ? (
              <Badge tone="grey">{t('settings.checking')}</Badge>
            ) : usage.kind === 'memory' ? (
              <Badge tone="red">{t('settings.notPersistent')}</Badge>
            ) : (
              <Badge tone="green">IndexedDB</Badge>
            )}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12.5px]">
              <span className="text-ink-muted">{t('settings.used')}</span>
              <span className="font-semibold text-ink">
                {t('settings.usedOf', { used: formatBytes(usage?.usage ?? null), quota: formatBytes(usage?.quota ?? null) })}
              </span>
            </div>
            <ProgressBar value={share ?? 0} tone={share !== null && share > 80 ? 'red' : 'blue'} label={t('settings.storageUsed')} />
            {usage && share === null ? <p className="mt-1 text-[11.5px] text-ink-muted">{t('settings.noQuota')}</p> : null}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {SAVE_SLOT_IDS.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="flex items-center gap-2 text-ink">
                  <HardDrive className="size-3.5 text-ink-soft" aria-hidden />
                  {t('common.slot', { n: id })}
                  {slot === id ? <Badge tone="blue">{t('common.current')}</Badge> : null}
                </span>
                <span className="min-w-0 truncate text-ink-muted">{slots[id - 1]?.playerName ?? t('common.empty')}</span>
                <span className="font-semibold text-ink">{formatBytes(usage?.slots[id] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-muted">{t('settings.ballByBall')}</p>
        </Card>

        <Card>
          <CardHeader title={t('settings.saves')} className="mb-1" />
          <Row title={t('settings.autosave')} hint={t('settings.autosaveHint')}>
            <Toggle label={t('settings.autosave')} checked={state?.settings.autosave ?? true} disabled={!state} onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, autosave: v } }))} />
          </Row>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!state} onClick={() => saveNow()} className="rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">
              {t('settings.saveNow')}
            </button>
            <button type="button" disabled={!state} onClick={() => exportCareer() && pushToast({ tone: 'success', message: t('toast.saveDownloaded') })} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40">
              <Download className="size-3.5" aria-hidden />
              {t('settings.export')}
            </button>
            <button type="button" disabled={slot === null} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40">
              <Upload className="size-3.5" aria-hidden />
              {t('settings.import')}
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label={t('settings.importLabel')} onChange={(e) => void onPickFile(e.target.files?.[0])} />
            <Link to="/slots" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink">
              <FolderOpen className="size-3.5" aria-hidden />
              {t('settings.manageSlots')}
            </Link>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <button type="button" disabled={slot === null} onClick={() => setConfirm('delete')} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-red/40 px-3.5 py-2 text-[12.5px] font-semibold text-brand-red hover:bg-brand-red/5 disabled:opacity-40">
              <Trash2 className="size-3.5" aria-hidden />
              {t('settings.delete')}
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('settings.tutorial')} className="mb-1" />
          <Row title={t('settings.tips')} hint={`${app.tipsSeen.length ? (app.tipsSeen.length === 1 ? t('settings.tipDismissed') : t('settings.tipsDismissed', { n: app.tipsSeen.length })) : t('settings.tipsAll')} ${t('settings.tipsWhere')}`}>
            <button
              type="button"
              onClick={() => {
                app.resetTutorial();
                pushToast({ tone: 'info', message: t('toast.tipsReset') });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
            >
              <Lightbulb className="size-3.5" aria-hidden />
              {t('settings.resetTutorial')}
            </button>
          </Row>
        </Card>

        <Card>
          <CardHeader title={t('settings.install')} subtitle={t('settings.installHint')} className="mb-1" />
          {pwa.installed ? (
            <p className="flex items-center gap-2 py-2 text-[13px] text-ink"><Smartphone className="size-4 text-brand-green" aria-hidden /> {t('settings.installed')}</p>
          ) : pwa.canInstall ? (
            <Row title={t('settings.addToDevice')} hint={t('settings.addToDeviceHint')}>
              <button type="button" onClick={() => void promptInstall()} className="rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white">
                {t('banner.installButton')}
              </button>
            </Row>
          ) : pwa.iosManual ? (
            <p className="py-2 text-[13px] text-ink">{t('settings.iosInstall')}</p>
          ) : (
            <p className="py-2 text-[13px] text-ink-muted">{t('settings.browserInstall')}</p>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title={t('settings.deleteTitle')}
        message={t('settings.deleteMessage', { who: state ? t('settings.deleteWho', { name: `${state.player.firstName} ${state.player.lastName}` }) : t('settings.deleteThis'), slot: slot ?? '' })}
        confirmLabel={t('settings.deleteConfirm')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (slot !== null && deleteCareer(slot)) {
            pushToast({ tone: 'success', message: t('toast.careerDeleted') });
            navigate('/slots');
          }
        }}
      />
      <ConfirmDialog
        open={confirm === 'import'}
        danger
        title={t('settings.importTitle')}
        message={t('settings.importMessage', { slot: slot ?? '' })}
        confirmLabel={t('settings.importConfirm')}
        onCancel={() => {
          setConfirm(null);
          setPending(null);
        }}
        onConfirm={() => {
          setConfirm(null);
          if (pending && slot !== null && importCareer(pending, slot)) pushToast({ tone: 'success', message: t('toast.saveImported') });
          setPending(null);
        }}
      />
      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-muted"><Gauge className="size-3.5" aria-hidden /> {t('settings.difficultyNote')}</p>
    </div>
  );
}
