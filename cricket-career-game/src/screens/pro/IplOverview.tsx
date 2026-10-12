/**
 * "My IPL": the whole IPL career on one page - every deal signed and what it
 * paid, why the player is (or is not) going into the auction, what the room
 * would pay today and which franchises' scouts are watching.
 */
import { ArrowRight, Flame, Gavel, Handshake, Repeat, UserPlus } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, ProgressBar, StatTile } from '@/components';
import { AUCTION } from '@/engine/config';
import { FRANCHISES_BY_ID } from '@/data/franchises';
import { auctionPreview, iplYearLabel, isMegaSeason } from '@/engine/pro/ipl';
import { formatLakh, franchiseName } from '@/lib/pro';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { useGameStore } from '@/store/gameStore';
import type { GameState, IplDeal } from '@/types';

const HOW_ICON = { AUCTION: Gavel, RETAINED: Repeat, TRADE: Handshake, REPLACEMENT: UserPlus } as const;

/** Every deal, oldest first: the recorded history, or (older saves) the contracts on file. */
export function iplDeals(state: GameState): (Omit<IplDeal, 'how'> & { how: IplDeal['how'] | null })[] {
  if (state.pro.ipl.history?.length) return state.pro.ipl.history;
  return state.player.contracts
    .filter((c) => c.level === 'FRANCHISE')
    .map((c) => ({ date: `${c.fromSeason}-12-16`, seasonYear: c.fromSeason, franchiseId: c.teamId, how: null, salary: c.value, previous: null }));
}

/** The season whose December holds the next mega auction. */
export function nextMegaAuction(state: GameState): number {
  let y = state.season.year;
  if (isMegaSeason(y) && state.season.currentDate > `${y}-12-16`) y += 1;
  while (!isMegaSeason(y)) y += 1;
  return y;
}

export function IplOverview({ state, onOpenTab }: { state: GameState; onOpenTab: (tab: string) => void }) {
  const t = useT();
  const requestAuction = useGameStore((s) => s.requestAuction);
  const ipl = state.pro.ipl;
  const deals = iplDeals(state);
  const preview = auctionPreview(state);
  const bidders = preview.bidders.filter((b) => b.max > 0).slice(0, 5);
  const watching = preview.bidders.filter((b) => b.interest >= AUCTION.scoutedAt && b.franchiseId !== ipl.franchiseId).sort((a, b) => b.interest - a.interest);
  const mega = nextMegaAuction(state);
  const team = ipl.franchiseId ? state.teams[ipl.franchiseId] : null;

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader title={t('pro.my.where')} className="mb-2" />
        {ipl.contract ? (
          <div className="flex flex-wrap items-center gap-3">
            {team ? <Crest crest={team.crest} size={44} label={franchiseName(ipl.franchiseId)} /> : null}
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-ink">{franchiseName(ipl.franchiseId)}</p>
              <p className="text-[13px] text-ink-muted">
                {t('pro.my.deal', { amount: formatLakh(ipl.contract.salary), to: iplYearLabel(ipl.contract.toSeason) })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">{t('pro.my.noTeam')}</p>
        )}
        <div className="mt-3 rounded-tile bg-page p-3 text-[13px] text-ink">
          <p className="font-semibold">{t('pro.my.nextMega', { date: formatLongDate(`${mega}-12-16`) })}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {ipl.contract
              ? ipl.intoAuction
                ? t('pro.my.whyIn', { team: franchiseName(ipl.franchiseId) })
                : t('pro.my.whyNot', { team: franchiseName(ipl.franchiseId) })
              : t('pro.my.whyFree')}
          </p>
          {ipl.contract && !ipl.retentionOffer ? (
            <button
              type="button"
              onClick={() => requestAuction(!ipl.intoAuction)}
              className={cn('mt-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold', ipl.intoAuction ? 'border border-line bg-surface text-ink' : 'bg-brand-gold text-brand-navy')}
            >
              {ipl.intoAuction ? t('pro.ct.stay') : t('pro.ct.go')}
            </button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('pro.my.auctionToday')} subtitle={t('pro.my.auctionTodaySub')} className="mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t('pro.ipl.marketValue')} value={formatLakh(preview.value)} />
            <StatTile label={t('pro.my.base')} value={formatLakh(preview.base)} />
            <StatTile label={t('pro.my.range')} value={<span className="text-[14px]">{preview.low ? `${formatLakh(preview.low)} – ${formatLakh(preview.high)}` : t('pro.my.unsold')}</span>} />
          </div>
          {preview.hot ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-orange">
              <Flame className="size-4" aria-hidden /> {t('pro.my.hot')}
            </p>
          ) : null}
          <h3 className="mt-3 mb-1.5 text-[13px] font-semibold text-ink">{t('pro.my.bidders')}</h3>
          {bidders.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.my.noBidders')}</p> : null}
          <ul className="flex flex-col gap-1.5">
            {bidders.map((b) => (
              <li key={b.franchiseId} className="flex items-center gap-2 text-[13px]">
                <span className="w-12 shrink-0 font-semibold text-ink">{FRANCHISES_BY_ID[b.franchiseId]?.short ?? b.franchiseId}</span>
                <ProgressBar value={(b.max / Math.max(1, bidders[0].max)) * 100} tone={b.franchiseId === ipl.franchiseId ? 'navy' : 'blue'} height={6} className="flex-1" label={t('pro.my.upTo', { amount: formatLakh(b.max) })} />
                <span className="w-24 shrink-0 text-right text-ink">{t('pro.my.upTo', { amount: formatLakh(b.max) })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-muted">{t('pro.my.estimate')}</p>
        </Card>

        <Card>
          <CardHeader title={t('pro.my.scouts')} subtitle={t('pro.my.scoutsSub', { n: Math.round(state.pro.scouting.reputation) })} className="mb-3" />
          {watching.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.my.noScouts')}</p> : null}
          <ul className="flex flex-col gap-1.5">
            {watching.slice(0, 6).map((b) => (
              <li key={b.franchiseId} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{franchiseName(b.franchiseId)}</span>
                <Badge tone={b.interest >= AUCTION.shortlistAt ? 'green' : b.interest >= AUCTION.trialAt ? 'orange' : 'grey'} className="shrink-0 text-[11px]">
                  {t(b.interest >= AUCTION.shortlistAt ? 'pro.my.lvl.shortlist' : b.interest >= AUCTION.trialAt ? 'pro.my.lvl.trial' : 'pro.my.lvl.watching')}
                </Badge>
                <span className="w-8 shrink-0 text-right font-semibold text-ink">{b.interest}</span>
              </li>
            ))}
          </ul>
          {state.pro.scouting.notes.length ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{t('pro.sc.notes')}</h3>
              <ul className="flex flex-col gap-1 text-[12.5px]">
                {state.pro.scouting.notes.slice(0, 3).map((n, i) => (
                  <li key={`${n.date}-${i}`} className="flex gap-2">
                    <span className={cn('w-10 shrink-0 font-semibold', n.delta >= 0 ? 'text-brand-green' : 'text-brand-red')}>{n.delta >= 0 ? '+' : ''}{n.delta}</span>
                    <span className="text-ink-muted">{n.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" onClick={() => onOpenTab('scouting')} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
            {t('pro.my.allScouting')} <ArrowRight className="size-3.5" aria-hidden />
          </button>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('pro.my.journey')} subtitle={t('pro.my.earned', { amount: formatLakh(ipl.earnings) })} className="mb-3" />
        {deals.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.my.noDeals')}</p> : null}
        <ol className="flex flex-col gap-2">
          {[...deals].reverse().map((d, i) => {
            const Icon = d.how ? HOW_ICON[d.how] : ArrowRight;
            return (
              <li key={`${d.seasonYear}-${d.franchiseId}-${i}`} className="flex items-start gap-3 rounded-tile bg-page px-3 py-2.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-blue-soft text-brand-blue">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">
                    {iplYearLabel(d.seasonYear)} · {franchiseName(d.franchiseId)}
                  </p>
                  <p className="text-[12.5px] text-ink-muted">
                    {t((d.how ? `pro.my.how.${d.how}` : 'pro.my.how.SIGNED') as Key, { amount: formatLakh(d.salary) })}
                    {d.previous !== null && d.previous !== d.salary ? t('pro.my.was', { amount: formatLakh(d.previous) }) : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-bold text-ink">{formatLakh(d.salary)}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
