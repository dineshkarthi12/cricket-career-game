/**
 * The player's career card: a snapshot of the career to share. The share,
 * download and copy buttons report what the browser actually did.
 */
import { useMemo, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { careerCardData, careerCardText } from '@/engine/career/careerCard';
import { roleLabel } from '@/lib/format';
import { copyCardText, downloadCard, renderCardPng, shareCard, type ShareOutcome } from '@/lib/shareCard';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

export default function CareerCardScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <CareerCard state={state} />;
}

const MESSAGES: Record<ShareOutcome['status'], string> = {
  shared: 'Shared.',
  downloaded: 'Image saved to your downloads.',
  copied: 'Card text copied to the clipboard.',
  cancelled: 'Sharing cancelled - nothing was sent.',
  unavailable: '',
  failed: '',
};

function CareerCard({ state }: { state: GameState }) {
  const card = useMemo(() => careerCardData(state, roleLabel), [state]);
  const text = careerCardText(card);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const fileName = `${card.name.replace(/\s+/g, '-').toLowerCase() || 'career'}-card.png`;

  const act = async (fn: () => Promise<ShareOutcome> | ShareOutcome) => {
    setBusy(true);
    try {
      setOutcome(await fn());
    } finally {
      setBusy(false);
    }
  };

  const message = outcome
    ? outcome.status === 'unavailable' || outcome.status === 'failed'
      ? `${outcome.reason} Try another option below.`
      : MESSAGES[outcome.status]
    : null;

  const tiles: [string, string][] = [
    ['Matches', String(card.matches)],
    ['Runs', String(card.runs)],
    ['Average', card.battingAverage !== null ? String(card.battingAverage) : '-'],
    ['Strike rate', card.strikeRate !== null ? String(card.strikeRate) : '-'],
    ['High score', card.highScore],
    ['100s / 50s', `${card.hundreds} / ${card.fifties}`],
    ['Wickets', String(card.wickets)],
    ['Best bowling', card.best ?? '-'],
    ['Trophies', String(card.trophies)],
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Career card</h1>
        <p className="text-[13px] text-ink-muted">Your career so far, ready to share. Every figure comes from your matches.</p>
      </div>

      <section
        aria-label="Career card"
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border-4 border-brand-gold bg-gradient-to-b from-brand-navy to-[#1e3a78] p-5 text-white shadow-card-hover"
      >
        <p className="text-[12px] font-bold tracking-[0.18em] text-brand-gold uppercase">Cricket Career 26</p>
        <h2 className="mt-1 text-[26px] leading-tight font-bold">{card.name}</h2>
        <p className="text-[13px] text-[#c9d6f5]">
          {card.role}
          {card.age !== null ? ` · Age ${card.age}` : ''}
        </p>
        <p className="text-[13px] text-[#c9d6f5]">
          Stage {card.stageNumber}/{card.totalStages} · {card.stage}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white/10 px-2.5 py-2">
              <dt className="text-[11px] text-[#c9d6f5]">{label}</dt>
              <dd className="text-[18px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] font-bold text-brand-gold uppercase">Achievements</p>
        <p className="text-[13px]">{card.achievements.length ? card.achievements.join(' · ') : 'The first one is still to come.'}</p>
        <p className="mt-3 text-[12px] font-bold text-brand-gold uppercase">Chasing</p>
        <p className="text-[13px]">{card.target}</p>
      </section>

      <Card>
        <CardHeader title="Share" subtitle="Uses your device's share sheet where it has one" className="mb-3" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => shareCard(text, await renderCardPng(card), fileName))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-blue px-4 text-[13px] font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
          >
            <Share2 className="size-4" aria-hidden /> Share
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => downloadCard(await renderCardPng(card), fileName))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden /> Save image
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => copyCardText(text))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <Copy className="size-4" aria-hidden /> Copy text
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-[12.5px] text-ink-muted">
          {message}
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">Show the text</summary>
          <pre className="mt-2 rounded-lg bg-page p-3 text-[12px] whitespace-pre-wrap text-ink">{text}</pre>
        </details>
      </Card>
    </div>
  );
}
