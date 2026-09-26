import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Play, Plus, Sparkles, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Card } from '@/components';
import { Logo } from '@/layout/Logo';
import { readSaveFile } from '@/save/file';
import { getActiveSlot } from '@/save';
import { formatLongDate } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { SAVE_SLOT_IDS, type SaveMeta, type SaveSlotId } from '@/types';

/**
 * The title screen: carry on, start again, pick a slot or bring a save in
 * from a file - plus the design's demo career for a look around.
 */
export default function StartScreen() {
  const navigate = useNavigate();
  const slots = useGameStore((s) => s.slots);
  const loaded = useGameStore((s) => s.state);
  const loadedSlot = useGameStore((s) => s.slot);
  const refreshSlots = useGameStore((s) => s.refreshSlots);
  const loadCareer = useGameStore((s) => s.loadCareer);
  const importCareer = useGameStore((s) => s.importCareer);
  const loadDemoCareer = useGameStore((s) => s.loadDemoCareer);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const firstEmpty = SAVE_SLOT_IDS.find((id) => !slots[id - 1]) ?? null;
  const lastSlot: SaveSlotId | null =
    loadedSlot ?? getActiveSlot() ?? SAVE_SLOT_IDS.find((id) => slots[id - 1]) ?? null;
  const last: SaveMeta | null = lastSlot ? slots[lastSlot - 1] : null;

  const onContinue = () => {
    if (loaded && loadedSlot === lastSlot) return navigate('/');
    if (lastSlot && loadCareer(lastSlot)) navigate('/');
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (!firstEmpty) {
      setNotice('All three slots are in use. Import into a slot from Load slot, or delete a career first.');
      return;
    }
    const read = await readSaveFile(file);
    if (read.ok && importCareer(read.value, firstEmpty)) navigate('/');
    if (fileInput.current) fileInput.current.value = '';
  };

  const onDemo = () => {
    if (!firstEmpty) {
      setNotice('The demo needs an empty slot. Delete a career from Load slot first.');
      return;
    }
    if (loadDemoCareer(firstEmpty)) navigate('/');
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="relative overflow-hidden bg-brand-navy">
        <img src="/assets/banner-bg.jpg" alt="" aria-hidden className="absolute inset-0 size-full object-cover object-center" />
        <div className="banner-wash absolute inset-0" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 md:py-16">
          <Logo variant="light" />
          <div>
            <p className="font-hand text-[30px] leading-none text-brand-gold">More than a game.</p>
            <h1 className="mt-2 max-w-xl text-[30px] leading-tight font-bold text-white sm:text-[38px]">
              From the school nets to the India cap.
            </h1>
            <p className="mt-2 max-w-lg text-[14px] text-white/75">
              You are one cricketer. Train, stay fit, take your chances - and earn every step. Nothing is handed out.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={onContinue}
              disabled={!last}
              className="flex items-center gap-3 rounded-card bg-brand-gold px-4 py-3.5 text-left text-brand-navy transition-colors hover:bg-brand-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-5 fill-brand-navy" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">Continue</span>
                <span className="block text-[12px] opacity-80">
                  {last ? `${last.playerName} · ${last.stageLabel}` : 'No career yet'}
                </span>
              </span>
            </button>
            <Link
              to={firstEmpty ? `/new?slot=${firstEmpty}` : '/new'}
              className="flex items-center gap-3 rounded-card bg-brand-blue px-4 py-3.5 text-white transition-colors hover:bg-brand-blue/90"
            >
              <Plus className="size-5" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">New Career</span>
                <span className="block text-[12px] text-white/80">Create your cricketer, aged 8-12</span>
              </span>
            </Link>
            <Link
              to="/slots"
              className="flex items-center gap-3 rounded-card bg-white/10 px-4 py-3.5 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <FolderOpen className="size-5" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">Load slot</span>
                <span className="block text-[12px] text-white/75">
                  {slots.filter(Boolean).length} of 3 slots in use
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-3 rounded-card bg-white/10 px-4 py-3.5 text-left text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <Upload className="size-5" aria-hidden />
              <span>
                <span className="block text-[15px] font-bold">Import save</span>
                <span className="block text-[12px] text-white/75">From an exported .json file</span>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import a save file"
              onChange={(event) => void onImport(event.target.files?.[0])}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {lastError || notice ? (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3">
            <p className="text-[13.5px] text-ink">{notice ?? lastError?.message}</p>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                clearError();
              }}
              className="shrink-0 text-[12.5px] font-semibold text-brand-red"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {SAVE_SLOT_IDS.map((id) => {
            const meta = slots[id - 1];
            return (
              <Card key={id} className="flex items-center gap-3">
                {meta ? (
                  <>
                    <Avatar name={meta.playerName} size={40} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{meta.playerName}</p>
                      <p className="truncate text-[12px] text-ink-muted">
                        {meta.stageLabel} · age {meta.age} · {formatLongDate(meta.inGameDate)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadCareer(id) && navigate('/')}
                      className="rounded-lg bg-brand-blue-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-blue"
                    >
                      Load
                    </button>
                  </>
                ) : (
                  <>
                    <span className="grid size-10 place-items-center rounded-full bg-page text-ink-soft" aria-hidden>
                      <Plus className="size-4" />
                    </span>
                    <p className="flex-1 text-[13px] text-ink-muted">Slot {id} is empty</p>
                    <Badge tone="grey">Free</Badge>
                  </>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-gold/20 text-[#8a6a00]" aria-hidden>
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">Demo career: Dinesh, 16</p>
              <p className="text-[12.5px] text-ink-muted">
                The career from the design - State U-16, Vijay Merchant Trophy, mid-season. Loads into a free slot.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDemo}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-page"
          >
            Play the demo
          </button>
        </Card>
      </main>

      <p className="font-hand pb-8 text-center text-[21px] text-ink-muted">Every great player was once a beginner.</p>
    </div>
  );
}
