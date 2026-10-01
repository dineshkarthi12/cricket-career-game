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
import { validateNewManager } from '@/engine/manager';
import { readSaveFile } from '@/save/file';
import { useManagerStore } from '@/store/managerStore';
import { MANAGER_SLOT_IDS, type ManagerDifficulty, type ManagerPathway, type ManagerSlotId } from '@/types/manager';
import { cn } from '@/lib/cn';
import { Button, FranchiseCrest } from './ui';

const PATHWAYS: { id: ManagerPathway; title: string; text: string }[] = [
  { id: 'SCOUTING', title: 'Start in scouting', text: 'Head of Scouting: find the talent, run trials, shape the shortlist. Earn the auction, then the dugout.' },
  { id: 'DIRECT', title: 'Straight into the hot seat', text: 'Head Coach from day one: auction, XI, tactics and results. Less money, an impatient board.' },
];

const DIFFICULTIES: { id: ManagerDifficulty; label: string }[] = [
  { id: 'EASY', label: 'Easy' },
  { id: 'NORMAL', label: 'Normal' },
  { id: 'HARD', label: 'Hard' },
];

export default function ManagerStart() {
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
    if (await newCareer(target, { name, franchiseId, difficulty, pathway, fullControl })) navigate('/manager');
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
              <ArrowLeft className="size-4" aria-hidden /> Player Career
            </Link>
          </div>
          <div>
            <p className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-2.5 py-1 text-[12px] font-bold tracking-wide text-brand-navy uppercase">
              <Crown className="size-4" aria-hidden /> IPL Manager
            </p>
            <h1 className="mt-3 max-w-2xl text-[28px] leading-tight font-bold text-white sm:text-[36px]">From the scouting trail to a franchise dynasty.</h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/75">You are not on the field. Scout, recruit, bid, pick and plan - and answer to a board that expects results.</p>
          </div>
          {state && loadedSlot ? (
            <Link to="/manager" className="inline-flex w-fit min-h-11 items-center gap-3 rounded-card bg-brand-gold px-4 py-3 text-brand-navy hover:bg-brand-gold/90">
              <Play className="size-5 fill-brand-navy" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">Continue</span>
                <span className="block text-[12px] opacity-80">{state.profile.name} · {state.franchises[state.franchiseId].short} · {state.season.year}</span>
              </span>
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <h2 className="mb-2 text-[16px] font-semibold text-ink">Manager saves</h2>
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
                        <p className="truncate text-[12px] text-ink-muted">{meta.rank} · {meta.franchise}</p>
                        <p className="text-[12px] text-ink-muted">Season {meta.season} · {meta.trophies} title{meta.trophies === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={async () => (await load(id)) && navigate('/manager')} disabled={busy}>
                        Load
                      </Button>
                      <Button variant="secondary" aria-label={`Delete manager save ${id}`} onClick={() => setConfirmDelete(id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-page text-ink-soft" aria-hidden>
                      <Plus className="size-4" />
                    </span>
                    <p className="flex-1 text-[13px] text-ink-muted">Slot {id} is empty</p>
                    <Badge tone="grey">Free</Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={!firstEmpty}>
            <Upload className="size-4" aria-hidden /> Import manager save
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import a manager save file"
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
            <Briefcase className="size-5 text-brand-blue" aria-hidden /> New manager career
          </h2>
          <form
            className="mt-3 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <label className="block text-[12.5px] font-semibold text-ink">
              Manager name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={tried && !name.trim()}
                aria-describedby="name-error"
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[14px] focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
                placeholder="e.g. Asha Rao"
              />
              {tried && errors.length ? (
                <span id="name-error" role="alert" className="mt-1 block text-[12px] font-medium text-brand-red">
                  {errors[0]}
                </span>
              ) : null}
            </label>

            <fieldset>
              <legend className="mb-2 text-[12.5px] font-semibold text-ink">Franchise</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Franchise">
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
              <legend className="mb-2 text-[12.5px] font-semibold text-ink">Pathway</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pathway">
                {PATHWAYS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={pathway === p.id}
                    onClick={() => setPathway(p.id)}
                    className={cn('rounded-xl border px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', pathway === p.id ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className="block text-[13.5px] font-semibold text-ink">{p.title}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-muted">{p.text}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3', fullControl ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}>
              <input type="checkbox" checked={fullControl} onChange={(e) => setFullControl(e.target.checked)} className="mt-0.5 size-4 accent-brand-blue" />
              <span>
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <SlidersHorizontal className="size-4 text-brand-blue" aria-hidden /> Full control
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-muted">
                  You do every job from the first week: scouting trips, trials, retentions, every auction bid, the XI, tactics and every match. Continue never plays anything for you. Off: jobs above your rank are done by the franchise staff.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-4">
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-semibold text-ink">Difficulty</legend>
                <div className="inline-flex rounded-xl bg-page p-1" role="radiogroup" aria-label="Difficulty">
                  {DIFFICULTIES.map((d) => (
                    <button key={d.id} type="button" role="radio" aria-checked={difficulty === d.id} onClick={() => setDifficulty(d.id)} className={cn('min-h-10 rounded-lg px-4 text-[12.5px] font-semibold', difficulty === d.id ? 'bg-surface text-brand-blue shadow-card' : 'text-ink-muted')}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-[12.5px] font-semibold text-ink">
                Save to
                <select value={target} onChange={(e) => setSlot(Number(e.target.value) as ManagerSlotId)} className="mt-1 block min-h-11 rounded-lg border border-line bg-surface px-3 text-[13px]">
                  {MANAGER_SLOT_IDS.map((id) => (
                    <option key={id} value={id}>
                      Slot {id}
                      {slots[id - 1] ? ` (overwrite ${slots[id - 1]!.managerName})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="gold" disabled={busy} className="ml-auto">
                {busy ? 'Building the league…' : 'Start managing'}
              </Button>
            </div>
          </form>
        </Card>
      </main>

      <ConfirmDialog
        open={confirmDelete !== null}
        danger
        title="Delete this manager save?"
        message="The whole manager career in this slot - seasons, squads, history - will be deleted. Your player careers are not affected."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await remove(confirmDelete);
          setConfirmDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmOverwrite}
        danger
        title={`Overwrite slot ${target}?`}
        message={`Slot ${target} holds ${slots[target - 1]?.managerName ?? 'a manager career'}. Starting here replaces it.`}
        confirmLabel="Overwrite"
        onCancel={() => setConfirmOverwrite(false)}
        onConfirm={async () => {
          setConfirmOverwrite(false);
          if (await newCareer(target, { name, franchiseId, difficulty, pathway, fullControl })) navigate('/manager');
        }}
      />
    </div>
  );
}
