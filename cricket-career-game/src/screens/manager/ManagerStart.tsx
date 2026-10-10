/**
 * IPL Manager entry: the three manager save slots and a new manager career.
 * Separate from the player-career slots; nothing here touches a career.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, Crown, Play, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Card, ConfirmDialog } from '@/components';
import { FRANCHISES } from '@/data/franchises';
import { Logo } from '@/layout/Logo';
import { MANAGER, validateNewManager } from '@/engine/manager';
import { readSaveFile } from '@/save/file';
import { useManagerStore } from '@/store/managerStore';
import { MANAGER_SLOT_IDS, type ManagerDifficulty, type ManagerPathway, type ManagerSlotId } from '@/types/manager';
import { cn } from '@/lib/cn';
import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { Button, FranchiseCrest, rankLabel } from './ui';

/** Titles and texts: `mgr.start.path.<id>.title` / `.text`. */
const PATHWAYS: ManagerPathway[] = ['SCOUTING', 'DIRECT'];

/** Labels: `mgr.start.diff.<id>`. */
const DIFFICULTIES: ManagerDifficulty[] = ['EASY', 'NORMAL', 'HARD'];

/** The engine's validation messages, translated. */
const ERROR_KEY: Record<string, Key> = {
  'Your manager needs a name.': 'mgr.start.err.name',
  'Keep the name under 40 characters.': 'mgr.start.err.long',
  'Choose a franchise.': 'mgr.start.err.franchise',
};

/** A save slot's rank (stored as the English label), in the current language. */
function slotRank(label: string): string {
  const rank = MANAGER.ranks.order.find((r) => MANAGER.ranks.label[r] === label);
  return rank ? rankLabel(rank) : label;
}

export default function ManagerStart() {
  const t = useT();
  const navigate = useNavigate();
  const { slots, refreshSlots, load, newCareer, remove, importToSlot, busy, state, slot: loadedSlot } = useManagerStore();
  const [name, setName] = useState('');
  const [franchiseId, setFranchiseId] = useState(FRANCHISES[0].id);
  const [pathway, setPathway] = useState<ManagerPathway>('SCOUTING');
  const [difficulty, setDifficulty] = useState<ManagerDifficulty>('NORMAL');
  const [fullControl, setFullControl] = useState(true);
  const [slot, setSlot] = useState<ManagerSlotId | null>(null);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ManagerSlotId | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => refreshSlots(), [refreshSlots]);
  const firstEmpty = MANAGER_SLOT_IDS.find((id) => !slots[id - 1]) ?? null;
  const target = slot ?? firstEmpty ?? 1;
  const errors = validateNewManager({ name, franchiseId, difficulty, pathway });

  const start = async () => {
    setTried(true);
    if (errors.length) return;
    if (slots[target - 1] && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    if (await newCareer(target, { name, franchiseId, difficulty, pathway, fullControl })) navigate(fullControl ? '/manager/scouting' : '/manager');
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="relative overflow-hidden bg-brand-navy">
        <img src="/assets/banner-bg.jpg" alt="" aria-hidden className="absolute inset-0 size-full object-cover object-center" />
        <div className="banner-wash absolute inset-0" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6 md:py-12">
          <div className="flex items-center justify-between gap-3">
            <Logo variant="light" />
            <Link to="/start" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-[13px] font-semibold text-white hover:bg-white/15">
              <ArrowLeft className="size-4" aria-hidden /> {t('mgr.start.playerCareer')}
            </Link>
          </div>
          <div>
            <p className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-2.5 py-1 text-[12px] font-bold tracking-wide text-brand-navy uppercase">
              <Crown className="size-4" aria-hidden /> {t('mgr.ipl')}
            </p>
            <h1 className="mt-3 max-w-2xl text-[28px] leading-tight font-bold text-white sm:text-[36px]">{t('mgr.start.title')}</h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/75">{t('mgr.start.lead')}</p>
          </div>
          {state && loadedSlot ? (
            <Link to="/manager" className="inline-flex w-fit min-h-11 items-center gap-3 rounded-card bg-brand-gold px-4 py-3 text-brand-navy hover:bg-brand-gold/90">
              <Play className="size-5 fill-brand-navy" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">{t('mgr.cont.continue')}</span>
                <span className="block text-[12px] opacity-80">{state.profile.name} · {state.franchises[state.franchiseId].short} · {state.season.year}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <h2 className="mb-2 text-[16px] font-semibold text-ink">{t('mgr.start.saves')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {MANAGER_SLOT_IDS.map((id) => {
            const meta = slots[id - 1];
            return (
              <Card key={id} className="flex flex-col gap-3">
                {meta ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar name={meta.managerName} size={40} decorative />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">{meta.managerName}</p>
                        <p className="truncate text-[12px] text-ink-muted">{slotRank(meta.rank)} · {meta.franchise}</p>
                        <p className="text-[12px] text-ink-muted">{t('mgr.seasonN', { year: meta.season })} · {t(meta.trophies === 1 ? 'mgr.start.title.one' : 'mgr.start.title.many', { n: meta.trophies })}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={async () => (await load(id)) && navigate('/manager')} disabled={busy}>
                        {t('mgr.start.load')}
                      </Button>
                      <Button variant="secondary" aria-label={t('mgr.start.deleteSave', { n: id })} onClick={() => setConfirmDelete(id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-page text-ink-soft" aria-hidden>
                      <Plus className="size-4" />
                    </span>
                    <p className="flex-1 text-[13px] text-ink-muted">{t('mgr.start.slotEmpty', { n: id })}</p>
                    <Badge tone="grey">{t('mgr.start.free')}</Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={!firstEmpty}>
            <Upload className="size-4" aria-hidden /> {t('mgr.start.import')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t('mgr.start.importFile')}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !firstEmpty) return;
              const read = await readSaveFile(file);
              if (read.ok) await importToSlot(firstEmpty, read.value);
              if (fileInput.current) fileInput.current.value = '';
            }}
          />
        </div>

        <Card className="mt-5">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <Briefcase className="size-5 text-brand-blue" aria-hidden /> {t('mgr.start.new')}
          </h2>
          <form
            className="mt-3 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <label className="block text-[12.5px] font-semibold text-ink">
              {t('mgr.start.name')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={tried && !name.trim()}
                aria-describedby="name-error"
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[14px] focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
                placeholder={t('mgr.start.namePlaceholder')}
              />
              {tried && errors.length ? (
                <span id="name-error" role="alert" className="mt-1 block text-[12px] font-medium text-brand-red">
                  {ERROR_KEY[errors[0]] ? t(ERROR_KEY[errors[0]]) : errors[0]}
                </span>
              ) : null}
            </label>

            <fieldset>
              <legend className="mb-2 text-[12.5px] font-semibold text-ink">{t('mgr.start.franchise')}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t('mgr.start.franchise')}>
                {FRANCHISES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={franchiseId === f.id}
                    onClick={() => setFranchiseId(f.id)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-xl border px-2 py-2 text-left text-[12px] font-semibold focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none',
                      franchiseId === f.id ? 'border-brand-blue bg-brand-blue-soft text-brand-blue' : 'border-line bg-surface text-ink hover:bg-page',
                    )}
                  >
                    <FranchiseCrest franchise={f} size={26} />
                    <span className="min-w-0">
                      <span className="block">{f.short}</span>
                      <span className="block truncate text-[10.5px] font-normal text-ink-muted">{f.city}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[12.5px] font-semibold text-ink">{t('mgr.start.pathway')}</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('mgr.start.pathway')}>
                {PATHWAYS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={pathway === p}
                    onClick={() => setPathway(p)}
                    className={cn('rounded-xl border px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', pathway === p ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className="block text-[13.5px] font-semibold text-ink">{t(`mgr.start.path.${p}.title`)}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-muted">{t(`mgr.start.path.${p}.text`)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3', fullControl ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}>
              <input type="checkbox" checked={fullControl} onChange={(e) => setFullControl(e.target.checked)} className="mt-0.5 size-4 accent-brand-blue" />
              <span>
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <SlidersHorizontal className="size-4 text-brand-blue" aria-hidden /> {t('mgr.fullControl')}
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-muted">{t('mgr.start.fullControlText')}</span>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-4">
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-semibold text-ink">{t('mgr.start.difficulty')}</legend>
                <div className="inline-flex rounded-xl bg-page p-1" role="radiogroup" aria-label={t('mgr.start.difficulty')}>
                  {DIFFICULTIES.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={difficulty === d} onClick={() => setDifficulty(d)} className={cn('min-h-10 rounded-lg px-4 text-[12.5px] font-semibold', difficulty === d ? 'bg-surface text-brand-blue shadow-card' : 'text-ink-muted')}>
                      {t(`mgr.start.diff.${d}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-[12.5px] font-semibold text-ink">
                {t('mgr.start.saveTo')}
                <select value={target} onChange={(e) => setSlot(Number(e.target.value) as ManagerSlotId)} className="mt-1 block min-h-11 rounded-lg border border-line bg-surface px-3 text-[13px]">
                  {MANAGER_SLOT_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t('common.slot', { n: id })}
                      {slots[id - 1] ? ` ${t('mgr.start.overwriteName', { name: slots[id - 1]!.managerName })}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="gold" disabled={busy} className="ml-auto">
                {busy ? t('mgr.start.building') : t('mgr.start.start')}
              </Button>
            </div>
          </form>
        </Card>
      </main>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title={t('mgr.start.deleteTitle')}
        message={t('mgr.start.deleteBody')}
        confirmLabel={t('mgr.start.delete')}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await remove(confirmDelete);
          setConfirmDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmOverwrite}
        danger
        title={t('mgr.start.overwriteTitle', { n: target })}
        message={t('mgr.start.overwriteBody', { n: target, name: slots[target - 1]?.managerName ?? t('mgr.start.aCareer') })}
        confirmLabel={t('mgr.start.overwrite')}
        onCancel={() => setConfirmOverwrite(false)}
        onConfirm={async () => {
          setConfirmOverwrite(false);
          if (await newCareer(target, { name, franchiseId, difficulty, pathway, fullControl })) navigate(fullControl ? '/manager/scouting' : '/manager');
        }}
      />
    </div>
  );
}
