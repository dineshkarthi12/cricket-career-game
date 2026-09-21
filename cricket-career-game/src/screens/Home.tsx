import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Database, Palette, Trophy } from 'lucide-react';
import { CAREER_STAGES, TOTAL_CAREER_STAGES } from '@/data/stages';
import { TOURNAMENTS } from '@/data/tournaments';
import { listSlots } from '@/save';
import { installAutosaveGuards } from '@/store/gameStore';
import type { SaveMeta } from '@/types';

const PALETTE = [
  { name: 'Primary', value: '#1E5EF0' },
  { name: 'Nav active', value: '#E8EFFE' },
  { name: 'Green', value: '#22A45D' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#E5484D' },
  { name: 'Gold', value: '#F5C518' },
  { name: 'Navy', value: '#0F1B33' },
];

const CHECKLIST = [
  'React + Vite + TypeScript project',
  'Tailwind, Zustand, React Router, recharts, lucide-react, Vitest',
  'GAME_SPEC.md written',
  'Data models in /src/types',
  'Save system: 3 slots, autosave, export / import JSON',
];

export default function Home() {
  const [slots, setSlots] = useState<(SaveMeta | null)[]>([null, null, null]);

  useEffect(() => {
    setSlots(listSlots());
    return installAutosaveGuards();
  }, []);

  return (
    <div className="min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[12px] bg-brand-navy">
            <Crown className="size-6 text-brand-gold" />
          </span>
          <div>
            <h1 className="wordmark text-xl leading-none text-brand-navy sm:text-2xl">
              Cricket Career
            </h1>
            <p className="mt-1 text-xs tracking-[0.2em] text-ink-soft uppercase">
              Play · Improve · Belong
            </p>
          </div>
        </header>

        <section className="rounded-card bg-surface p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-green/10">
              <CheckCircle2 className="size-5 text-brand-green" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">Setup complete</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Phase 1 is done. The project, data models and save system are in place — the
                dashboard and match engine come next.
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-tile bg-page px-3 py-2 text-sm text-ink-muted"
              >
                <CheckCircle2 className="size-4 shrink-0 text-brand-green" />
                {item}
              </li>
            ))}
          </ul>

          <p className="font-hand mt-6 text-2xl text-ink-muted">
            Every great player was once a beginner.
          </p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <StatCard
            icon={<Trophy className="size-4 text-brand-blue" />}
            label="Career stages"
            value={String(TOTAL_CAREER_STAGES)}
            detail={`${CAREER_STAGES[0].name} → ${CAREER_STAGES[TOTAL_CAREER_STAGES - 1].name}`}
          />
          <StatCard
            icon={<Trophy className="size-4 text-brand-blue" />}
            label="Competitions"
            value={String(TOURNAMENTS.length)}
            detail="School cricket through to the ODI World Cup"
          />
          <StatCard
            icon={<Database className="size-4 text-brand-blue" />}
            label="Save slots"
            value={`${slots.filter(Boolean).length} / 3`}
            detail={
              slots.some(Boolean)
                ? 'Careers found in local storage'
                : 'No careers saved yet'
            }
          />
        </div>

        <section className="mt-5 rounded-card bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="size-4 text-brand-blue" />
            <h2 className="text-base font-semibold text-ink">Design system</h2>
            <span className="ml-auto text-xs text-ink-soft">from design/dashboard.png</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {PALETTE.map((colour) => (
              <div key={colour.name} className="w-20">
                <div
                  className="h-12 w-full rounded-tile border border-line"
                  style={{ backgroundColor: colour.value }}
                />
                <p className="mt-1.5 text-[11px] font-medium text-ink">{colour.name}</p>
                <p className="text-[11px] text-ink-soft">{colour.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            Poppins for the UI, <span className="font-hand text-lg">Caveat for handwritten notes</span>,
            and a wide uppercase wordmark for the logo.
          </p>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-tile bg-brand-blue-soft">{icon}</span>
        <span className="text-sm font-medium text-ink-muted">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{detail}</p>
    </div>
  );
}
