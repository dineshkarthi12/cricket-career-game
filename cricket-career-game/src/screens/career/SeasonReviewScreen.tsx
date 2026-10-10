import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, Circle } from 'lucide-react';
import { useT } from '@/i18n/react';
import { tr } from '@/i18n/core';
import { Badge, Card, CardHeader, StatTile, Tabs } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { useGameStore } from '@/store/gameStore';
import { OUTCOME_TONE } from './CareerPathScreen';
import { statusTone } from './SelectionScreen';
import type { GameState, SeasonReview } from '@/types';

export default function SeasonReviewScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <Reviews state={state} />;
}

function Reviews({ state }: { state: GameState }) {
  const t = useT();
  const navigate = useNavigate();
  const dismissReview = useGameStore((s) => s.dismissReview);
  const reviews = state.career.seasonReviews;
  const [year, setYear] = useState<number | null>(state.career.pendingReview?.seasonYear ?? reviews.at(-1)?.seasonYear ?? null);
  const review = reviews.find((r) => r.seasonYear === year) ?? reviews.at(-1) ?? null;

  if (!review) {
    return (
      <Card className="mx-auto mt-6 max-w-xl text-center">
        <p className="text-[14px] text-ink">{t('car.rev.first')}</p>
        <Link to="/career" className="mt-3 inline-block text-[13px] font-semibold text-brand-blue">{t('car.rev.seeTargets')}</Link>
      </Card>
    );
  }
  const pending = state.career.pendingReview?.seasonYear === review.seasonYear;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] leading-tight font-bold text-ink">{t('car.rev.title', { label: review.label })}</h1>
          <p className="text-[13px] text-ink-muted">{t('car.rev.stageAge', { stage: t(`stage.${review.stageId}`), age: review.age })}</p>
        </div>
        {reviews.length > 1 ? (
          <Tabs
            tabs={reviews.slice(-6).map((r) => ({ id: String(r.seasonYear), label: r.label }))}
            value={String(review.seasonYear)}
            onChange={(id) => setYear(Number(id))}
            label={t('car.rev.seasons')}
          />
        ) : null}
      </div>

      <Verdict review={review} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t('stats.matches')} value={String(review.stats.matches)} />
        <StatTile label={t('stats.runs')} value={String(review.stats.runs)} detail={review.stats.average !== null ? t('car.rev.avg', { n: review.stats.average }) : undefined} />
        <StatTile label={t('car.strikeRate')} value={review.stats.strikeRate !== null ? String(review.stats.strikeRate) : '-'} />
        <StatTile label={t('car.wickets')} value={String(review.stats.wickets)} detail={review.stats.bowlingAverage !== null ? t('car.rev.avg', { n: review.stats.bowlingAverage }) : undefined} />
        <StatTile label={t('car.rev.fiftiesHundreds')} value={`${review.stats.fifties} / ${review.stats.hundreds}`} detail={`HS ${review.stats.highScore}`} />
        <StatTile label={t('stats.overall')} value={`${review.overall[0]} → ${review.overall[1]}`} detail={t('car.rev.avgRating', { n: review.stats.averageRating })} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('car.rev.targets')} className="mb-2" />
          {review.targets.length ? (
            <ul className="flex flex-col gap-1.5">
              {review.targets.map((x) => (
                <li key={x.label} className="flex items-center justify-between rounded-tile bg-page px-3 py-2 text-[13px]">
                  <span className="flex items-center gap-1.5 text-ink">
                    {x.met ? <CheckCircle2 className="size-4 text-brand-green" aria-hidden /> : <Circle className="size-4 text-ink-muted" aria-hidden />}
                    {x.label}
                  </span>
                  <span className="font-semibold text-ink">{x.progress}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-muted">{t('car.rev.noTargets')}</p>
          )}
        </Card>
        <Card>
          <CardHeader title={t('car.rev.squads')} className="mb-2" />
          <ul className="flex flex-col gap-2">
            {review.squads.map((p) => (
              <li key={p.tournamentId} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone={statusTone(p.status)}>{t(`status.${p.status}`)}</Badge>
                <span className="text-ink">{TOURNAMENTS_BY_ID[p.tournamentId]?.name ?? p.tournamentId}</span>
              </li>
            ))}
          </ul>
          {review.awards.length ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{t('car.awards')}</h3>
              <ul className="flex flex-col gap-1">
                {review.awards.map((a) => (
                  <li key={a} className="flex items-center gap-1.5 text-[13px] text-ink">
                    <Award className="size-4 text-brand-gold" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('car.rev.coach')} className="mb-2" />
          <p className="font-hand text-[20px] leading-snug text-ink">{review.coachReport}</p>
        </Card>
        <Card>
          <CardHeader title={t('car.rev.nextSeason')} subtitle={t(`stage.${review.nextStageId}`)} className="mb-2" />
          <ul className="flex flex-col gap-1 text-[13px] text-ink">
            {review.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Card>
      </div>

      {pending ? (
        <button
          type="button"
          onClick={() => {
            dismissReview();
            navigate('/');
          }}
          className="self-start rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy"
        >
          {t('car.rev.onward')}
        </button>
      ) : null}
    </div>
  );
}

function Verdict({ review }: { review: SeasonReview }) {
  const t = useT();
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={OUTCOME_TONE[review.outcome]}>{t(`outcome.${review.outcome}`)}</Badge>
        <h2 className="text-[18px] font-bold text-ink">{review.headline}</h2>
      </div>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-ink">
        {review.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}
