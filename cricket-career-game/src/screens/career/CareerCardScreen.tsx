/**
 * The player's career card: a snapshot of the career to share. The share,
 * download and copy buttons report what the browser actually did.
 */
import { useMemo, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { useLang, useT } from '@/i18n/react';
import { tr } from '@/i18n/core';
import { Card, CardHeader } from '@/components';
import { careerCardData, careerCardText } from '@/engine/career/careerCard';
import { roleLabel } from '@/lib/format';
import { copyCardText, downloadCard, renderCardPng, shareCard, type ShareOutcome } from '@/lib/shareCard';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

export default function CareerCardScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <CareerCard state={state} />;
}

function CareerCard({ state }: { state: GameState }) {
  const t = useT();
  const lang = useLang();
  // The role label follows the language, so the card is rebuilt when it changes.
  const card = useMemo(() => careerCardData(state, roleLabel), [state, lang]);
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
      ? `${outcome.reason} ${t('car.card.tryAnother')}`
      : t(`car.card.msg.${outcome.status}`)
    : null;

  const tiles: [string, string][] = [
    [t('stats.matches'), String(card.matches)],
    [t('stats.runs'), String(card.runs)],
    [t('stats.average'), card.battingAverage !== null ? String(card.battingAverage) : '-'],
    [t('car.strikeRate'), card.strikeRate !== null ? String(card.strikeRate) : '-'],
    [t('car.card.highScore'), card.highScore],
    [t('car.card.hundredsFifties'), `${card.hundreds} / ${card.fifties}`],
    [t('car.wickets'), String(card.wickets)],
    [t('car.card.bestBowling'), card.best ?? '-'],
    [t('car.card.trophies'), String(card.trophies)],
  ];

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('car.card.title')}</h1>
        <p className="text-[13px] text-ink-muted">{t('car.card.intro')}</p>
      </div>

      <section
        aria-label={t('car.card.title')}
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border-4 border-brand-gold bg-gradient-to-b from-brand-navy to-[#1e3a78] p-5 text-white shadow-card-hover"
      >
        <p className="text-[12px] font-bold tracking-[0.18em] text-brand-gold uppercase">Cricket Career 26</p>
        <h2 className="mt-1 text-[26px] leading-tight font-bold">{card.name}</h2>
        <p className="text-[13px] text-[#c9d6f5]">
          {card.role}
          {card.age !== null ? t('car.card.age', { n: card.age }) : ''}
        </p>
        <p className="text-[13px] text-[#c9d6f5]">
          {t('car.card.stage', { n: card.stageNumber, of: card.totalStages, stage: t(`stage.${state.career.currentStageId}`) })}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {tiles.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg bg-white/10 px-2.5 py-2">
              <dt className="text-[11px] break-words text-[#c9d6f5]">{label}</dt>
              <dd className="text-[18px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] font-bold text-brand-gold uppercase">{t('car.card.achievements')}</p>
        <p className="text-[13px]">{card.achievements.length ? card.achievements.join(' · ') : t('car.card.firstToCome')}</p>
        <p className="mt-3 text-[12px] font-bold text-brand-gold uppercase">{t('car.card.chasing')}</p>
        <p className="text-[13px]">{card.target}</p>
      </section>

      <Card>
        <CardHeader title={t('car.card.share')} subtitle={t('car.card.shareHint')} className="mb-3" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => shareCard(text, await renderCardPng(card), fileName))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-blue px-4 text-[13px] font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
          >
            <Share2 className="size-4" aria-hidden /> {t('car.card.share')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => downloadCard(await renderCardPng(card), fileName))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden /> {t('car.card.save')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => copyCardText(text))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <Copy className="size-4" aria-hidden /> {t('car.card.copy')}
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-[12.5px] text-ink-muted">
          {message}
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">{t('car.card.showText')}</summary>
          <pre className="mt-2 rounded-lg bg-page p-3 text-[12px] whitespace-pre-wrap text-ink">{text}</pre>
        </details>
      </Card>
    </div>
  );
}
