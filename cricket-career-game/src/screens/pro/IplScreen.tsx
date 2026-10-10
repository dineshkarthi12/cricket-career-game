import { useEffect, useMemo, useState } from 'react';
import { RetentionOfferPanel } from './RetentionOfferPanel';
import { Link } from 'react-router-dom';
import { Gavel, Play } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, ProgressBar, StatTile, Tabs } from '@/components';
import { AUCTION, IPL_RULES } from '@/engine/config';
import { FRANCHISES, FRANCHISES_BY_ID } from '@/data/franchises';
import { allowedBases, auctionEntry, defaultBase, iplYearLabel, isMegaSeason, lastIplImpact, rivalValue } from '@/engine/pro/ipl';
import { activePosts } from '@/engine/pro/leadership';
import { roleGroup, ROLE_GROUP_LABEL } from '@/engine/career/squads';
import type { FranchiseInfo } from '@/data/franchises';
import { formatLakh, franchiseName, marketValue } from '@/lib/pro';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ANIMATION_FACTOR, useAppSettings, useReducedMotion } from '@/store/appSettings';
import { useGameStore } from '@/store/gameStore';
import type { AuctionLot, AuctionSummary, GameState, IplStatus } from '@/types';

const TABS = ['scouting', 'auction', 'contract', 'franchises'];

/** An IPL status in the current language. */
const iplStatusKey = (status: IplStatus) => `pro.iplStatus.${status}` as Key;
/** A franchise's role group name ("batter"), translated. */
const groupKey = (role: string) => `group.${ROLE_GROUP_LABEL[roleGroup(role as never)]}` as Key;
const styleKey = (style: FranchiseInfo['style']) => `pro.style.${style}` as Key;

export default function IplScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <Ipl state={state} />;
}

function Ipl({ state }: { state: GameState }) {
  const [tab, setTab] = useState(state.pro.ipl.auctions.length ? 'auction' : 'scouting');
  const t = useT();
  const ipl = state.pro.ipl;
  const senior = state.career.stages.SENIOR_STATE?.status === 'COMPLETED';
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">IPL</h1>
        <p className="text-[13px] text-ink-muted">
          {t('pro.ipl.intro', { year: iplYearLabel(state.season.year), kind: isMegaSeason(state.season.year) ? '@pro.ipl.mega' : '@pro.ipl.mini' })}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t('pro.ipl.reputation')} value={Math.round(state.pro.scouting.reputation)} />
        <StatTile label={t('pro.ipl.status')} value={<span className="text-[13px] break-words">{t(iplStatusKey(ipl.status))}</span>} />
        <StatTile label={t('pro.ipl.franchise')} value={<span className="text-[13px]">{franchiseName(ipl.franchiseId)}</span>} />
        <StatTile label={t('pro.ipl.salary')} value={ipl.contract ? formatLakh(ipl.contract.salary) : '-'} />
        <StatTile label={t('pro.ipl.marketValue')} value={formatLakh(marketValue(state))} />
        <StatTile label={t('pro.ipl.earnings')} value={formatLakh(ipl.earnings)} />
      </div>
      {!senior ? (
        <Card>
          <p className="text-[13px] text-ink-muted">
            {t('pro.ipl.notSenior', { n: Math.round(state.pro.scouting.reputation) })}
          </p>
        </Card>
      ) : null}
      <Tabs tabs={TABS.map((id) => ({ id, label: t(`pro.ipl.tab.${id}` as Key) }))} value={tab} onChange={setTab} label={t('pro.ipl.tabsLabel')} />
      {tab === 'scouting' ? <Scouting state={state} /> : null}
      {tab === 'auction' ? <AuctionRoom state={state} /> : null}
      {tab === 'contract' ? <Contract state={state} /> : null}
      {tab === 'franchises' ? <Franchises state={state} /> : null}
    </div>
  );
}

function Scouting({ state }: { state: GameState }) {
  const s = state.pro.scouting;
  const interest = [...FRANCHISES].sort((a, b) => (s.interest[b.id] ?? 0) - (s.interest[a.id] ?? 0));
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('pro.ipl.reputation')} subtitle={t('pro.sc.subtitle')} className="mb-3" />
        <ProgressBar value={s.reputation} tone={s.reputation >= AUCTION.shortlistAt ? 'green' : s.reputation >= AUCTION.trialAt ? 'orange' : 'blue'} label={t('pro.ipl.reputation')} />
        <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-ink-muted">
          <span>{t('pro.sc.scouted', { n: AUCTION.scoutedAt })}</span>
          <span>·</span>
          <span>{t('pro.sc.trial', { n: AUCTION.trialAt })}</span>
          <span>·</span>
          <span>{t('pro.sc.shortlist', { n: AUCTION.shortlistAt })}</span>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          {t('pro.sc.builtFrom')}
        </p>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{t('pro.sc.notes')}</h3>
        {s.notes.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.sc.noNotes')}</p> : null}
        <ul className="flex flex-col gap-1">
          {s.notes.slice(0, 10).map((n, i) => (
            <li key={`${n.date}-${i}`} className="flex items-center justify-between gap-2 rounded-tile bg-page px-3 py-1.5 text-[12.5px]">
              <span className="text-ink">{n.reason}</span>
              <span className={cn('font-semibold', n.delta >= 0 ? 'text-brand-green' : 'text-brand-red')}>{n.delta > 0 ? '+' : ''}{n.delta}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('pro.sc.interest')} subtitle={t('pro.sc.interestSub')} className="mb-3" />
        <ul className="flex flex-col gap-2">
          {interest.map((f) => {
            const team = state.teams[f.id];
            return (
              <li key={f.id} className="flex items-center gap-2.5">
                {team ? <Crest crest={team.crest} size={26} label={f.name} /> : null}
                <span className="w-40 shrink-0 truncate text-[13px] text-ink">{f.name}</span>
                <ProgressBar value={s.interest[f.id] ?? 0} tone={(s.interest[f.id] ?? 0) >= AUCTION.trialAt ? 'green' : 'blue'} height={6} className="flex-1" label={t('pro.sc.interestAria', { name: f.name })} />
                <span className="w-8 text-right text-[12px] font-semibold text-ink">{s.interest[f.id] ?? 0}</span>
              </li>
            );
          })}
        </ul>
        <h3 className="mt-4 mb-1 text-[13px] font-semibold text-ink">{t('pro.sc.trials')}</h3>
        {s.trials.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.sc.noTrials')}</p> : null}
        <ul className="flex flex-col gap-1">
          {s.trials.map((trial) => (
            <li key={trial.date} className="rounded-tile bg-page px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-ink">{franchiseName(trial.franchiseId)}</span> · {formatLongDate(trial.date)} · {trial.bonus > 0 ? '+' : ''}{trial.bonus}: <span className="text-ink-muted">{trial.verdict}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function AuctionRoom({ state }: { state: GameState }) {
  const auctions = state.pro.ipl.auctions;
  const [index, setIndex] = useState(auctions.length - 1);
  const summary = auctions[index];
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <Registration state={state} />
      {!summary ? (
        <Card>
          <p className="text-[13px] text-ink-muted">{t('pro.ar.none')}</p>
        </Card>
      ) : (
        <>
          {auctions.length > 1 ? (
            <Tabs tabs={auctions.map((a, i) => ({ id: String(i), label: a.mega ? t('pro.ar.mega', { year: a.seasonYear }) : String(a.seasonYear) }))} value={String(index)} onChange={(v) => setIndex(Number(v))} label={t('pro.ar.auctions')} />
          ) : null}
          {index === auctions.length - 1 && summary.room?.length ? (
            <Link to="/auction/live" className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-[14px] font-bold text-white hover:bg-brand-navy/90">
              <Gavel className="size-4 text-brand-gold" aria-hidden />
              {summary.watched === false ? t('pro.ar.watchLive') : t('pro.ar.watchAgain')} · {t('pro.ar.lots', { n: summary.room.length })}
            </Link>
          ) : null}
          <AuctionView state={state} summary={summary} />
        </>
      )}
    </div>
  );
}

function Registration({ state }: { state: GameState }) {
  const registerBase = useGameStore((s) => s.registerBase);
  const entry = auctionEntry(state);
  const bases = allowedBases(state);
  const chosen = state.pro.ipl.registeredBase ?? defaultBase(state);
  const t = useT();
  if (state.pro.ipl.franchiseId || state.career.stages.SENIOR_STATE?.status !== 'COMPLETED') return null;
  return (
    <Card>
      <CardHeader title={t('pro.reg.title', { year: state.season.year })} subtitle={entry.reason} className="mb-3" />
      <p className="mb-2 text-[12.5px] text-ink-muted">
        {t('pro.reg.body', { max: formatLakh(AUCTION.uncappedMaxBase), value: formatLakh(marketValue(state)) })}
      </p>
      <div className="flex flex-wrap gap-2">
        {bases.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => registerBase(b)}
            className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold', b === chosen ? 'border-brand-blue bg-brand-blue text-white' : 'border-line bg-surface text-ink hover:bg-page')}
          >
            {formatLakh(b)}
          </button>
        ))}
      </div>
      {state.pro.ipl.registeredBase === null ? <p className="mt-2 text-[12px] text-ink-muted">{t('pro.reg.notChosen', { price: formatLakh(chosen) })}</p> : null}
    </Card>
  );
}

function AuctionView({ state, summary }: { state: GameState; summary: AuctionSummary }) {
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader
          title={`${summary.mega ? t('pro.av.mega') : t('pro.av.ipl')} · ${formatLongDate(summary.date)}`}
          subtitle={t('pro.av.sub', { year: iplYearLabel(summary.seasonYear), status: t(iplStatusKey(summary.userStatus)) })}
          className="mb-3"
        />
        {summary.userLot ? <LiveLot lot={summary.userLot} reduceMotion={state.settings.reduceMotion} /> : <p className="text-[13px] text-ink-muted">{t('pro.av.notIn')}</p>}
      </Card>
      <Card>
        <CardHeader title={t('pro.av.room')} subtitle={t('pro.av.biggest')} className="mb-2" />
        <ul className="flex flex-col gap-1">
          {summary.lots.filter((l) => !l.isUser).slice(0, 10).map((l) => (
            <li key={l.playerId} className="flex items-center justify-between gap-2 border-t border-line py-1.5 text-[12.5px]">
              <span className="min-w-0 truncate text-ink">
                {l.name} <span className="text-ink-muted">({t(groupKey(l.role))}{l.overseas ? t('pro.av.overseasNote') : ''}, {l.age})</span>
              </span>
              <span className="shrink-0 font-semibold text-ink">{l.price ? `${formatLakh(l.price)} → ${FRANCHISES_BY_ID[l.soldTo ?? '']?.short ?? ''}` : t('pro.iplStatus.UNSOLD')}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{t('pro.av.purses')}</h3>
        <div className="grid grid-cols-2 gap-1 text-[12px]">
          {FRANCHISES.map((f) => (
            <span key={f.id} className="flex justify-between rounded bg-page px-2 py-1">
              <span className="truncate text-ink-muted">{f.short}</span>
              <span className="font-semibold text-ink">{formatLakh(summary.pursesAfter[f.id] ?? 0)}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** The user's lot, bid by bid - replayed like the auction on television. */
function LiveLot({ lot, reduceMotion: careerReduce }: { lot: AuctionLot; reduceMotion: boolean }) {
  const reduceMotion = useReducedMotion(careerReduce);
  const factor = ANIMATION_FACTOR[useAppSettings((s) => s.animationSpeed)];
  const tx = useT();
  const [shown, setShown] = useState(reduceMotion ? lot.bids.length : 0);
  const [run, setRun] = useState(!reduceMotion);
  useEffect(() => {
    if (!run) return;
    if (shown >= lot.bids.length) {
      setRun(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 450 * factor);
    return () => clearTimeout(t);
  }, [run, shown, lot.bids.length, factor]);
  const current = lot.bids[shown - 1];
  const done = shown >= lot.bids.length;
  const bidders = useMemo(() => [...new Set(lot.bids.map((b) => b.franchiseId))], [lot.bids]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-tile bg-brand-navy p-4 text-white">
        <Gavel className="size-8 text-brand-gold" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/70">{tx('pro.lot.you', { price: formatLakh(lot.basePrice) })}</p>
          <p className="text-[24px] leading-tight font-bold">{current ? formatLakh(current.amount) : formatLakh(lot.basePrice)}</p>
          <p className="text-[13px] text-white/80">{current ? tx('pro.lot.holds', { team: franchiseName(current.franchiseId) }) : lot.bids.length ? tx('pro.lot.opens') : tx('pro.lot.noBids')}</p>
        </div>
        {done ? (
          <Badge tone={lot.soldTo ? 'green' : 'red'}>{lot.soldTo ? tx('pro.lot.soldTo', { team: franchiseName(lot.soldTo) }) : tx('pro.lot.unsold')}</Badge>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">{tx(bidders.length === 1 ? 'pro.lot.bids.one' : 'pro.lot.bids.many', { n: bidders.length, bids: lot.bids.length })}</p>
        <button type="button" onClick={() => { setShown(0); setRun(true); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
          <Play className="size-3.5" aria-hidden /> {tx('pro.lot.replay')}
        </button>
      </div>
      <ol className="mt-2 flex max-h-56 flex-col-reverse gap-1 overflow-y-auto">
        {lot.bids.slice(0, shown).map((b, i) => (
          <li key={i} className="flex justify-between rounded bg-page px-3 py-1 text-[12.5px]">
            <span className="text-ink">{franchiseName(b.franchiseId)}</span>
            <span className="font-semibold text-ink">{formatLakh(b.amount)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Contract({ state }: { state: GameState }) {
  const answerTrade = useGameStore((s) => s.answerTrade);
  const requestAuction = useGameStore((s) => s.requestAuction);
  const { impact, line } = lastIplImpact(state);
  const value = marketValue(state);
  const ipl = state.pro.ipl;
  const offer = ipl.tradeOffer;
  const posts = activePosts(state).filter((p) => p.level === 'IPL');
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('pro.ct.title')} subtitle={ipl.contract ? `${franchiseName(ipl.contract.franchiseId)} · ${t(`pro.how.${ipl.contract.how}` as Key)}` : t(iplStatusKey(ipl.status))} className="mb-3" />
        {ipl.contract ? (
          <ul className="grid grid-cols-2 gap-2 text-[13px]">
            <li className="rounded-tile bg-page p-2">{t('pro.ipl.salary')}<br /><span className="font-semibold text-ink">{t('pro.ct.aSeason', { amount: formatLakh(ipl.contract.salary) })}</span></li>
            <li className="rounded-tile bg-page p-2">{t('pro.ct.runsTo')}<br /><span className="font-semibold text-ink">{t('pro.ct.nextMega', { year: iplYearLabel(ipl.contract.toSeason) })}</span></li>
            <li className="rounded-tile bg-page p-2">{t('pro.ct.signed')}<br /><span className="font-semibold text-ink">{ipl.contract.fromSeason}</span></li>
            <li className="rounded-tile bg-page p-2">{t('pro.ct.role')}<br /><span className="font-semibold text-ink">{posts[0] ? (posts[0].role === 'CAPTAIN' ? t('m.captain') : t('pro.viceCaptain')) : t('pro.ct.squadPlayer')}</span></li>
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">{t('pro.ct.none')}</p>
        )}
        <p className="mt-3 text-[12.5px] text-ink-muted">
          {t(IPL_RULES.impactPlayer ? 'pro.ct.rulesImpact' : 'pro.ct.rulesNoImpact')}
        </p>
        {line ? (
          <div className="mt-3 rounded-tile bg-page p-3 text-[12.5px]">
            <p className="font-semibold text-ink">
              {t('pro.ct.lastIpl', { year: iplYearLabel(line.seasonYear), runs: line.runs, sr: line.balls ? ` (SR ${Math.round((line.runs / line.balls) * 100)})` : '', wickets: line.wickets, matches: line.matches })}
            </p>
            <p className={cn('mt-0.5', impact > 1 ? 'text-brand-green' : impact < 1 ? 'text-brand-red' : 'text-ink-muted')}>
              {t('pro.ct.counts', { impact: impact.toFixed(2), value: formatLakh(value) })}
              {impact >= AUCTION.hotImpact ? t('pro.ct.hot') : ''}
            </p>
          </div>
        ) : null}
        {ipl.contract && !ipl.retentionOffer ? (
          <div className={cn('mt-3 rounded-tile border p-3', ipl.intoAuction ? 'border-brand-gold bg-brand-gold/10' : 'border-line')}>
            <p className="text-[13px] font-semibold text-ink">{ipl.intoAuction ? t('pro.ct.intoAuction') : t('pro.ct.testMarket')}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {ipl.intoAuction
                ? t('pro.ct.intoBody', { team: franchiseName(ipl.franchiseId) })
                : t('pro.ct.stayBody', { salary: formatLakh(ipl.contract.salary), value: formatLakh(value) })}
            </p>
            <button
              type="button"
              onClick={() => requestAuction(!ipl.intoAuction)}
              className={cn('mt-2 rounded-full px-4 py-1.5 text-[13px] font-semibold', ipl.intoAuction ? 'border border-line bg-surface text-ink' : 'bg-brand-gold text-brand-navy')}
            >
              {ipl.intoAuction ? t('pro.ct.stay') : t('pro.ct.go')}
            </button>
          </div>
        ) : null}
        {ipl.retentionOffer ? (
          <div className="mt-3 rounded-tile border border-brand-blue bg-brand-blue-soft p-3">
            <RetentionOfferPanel offer={ipl.retentionOffer} />
          </div>
        ) : null}
        {offer ? (
          <div className="mt-3 rounded-tile border border-brand-blue bg-brand-blue-soft p-3">
            <p className="text-[13px] font-semibold text-ink">{t('pro.ct.trade', { team: franchiseName(offer.franchiseId), salary: formatLakh(offer.salary) })}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => answerTrade(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">{t('decisions.acceptTrade')}</button>
              <button type="button" onClick={() => answerTrade(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">{t('decisions.stay')}</button>
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <CardHeader title={t('pro.ct.seasons')} action={{ label: t('pro.ct.table'), to: '/tournaments/ipl' }} className="mb-2" />
        {ipl.seasons.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.ct.noSeasons')}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead className="text-[12px] text-ink-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">{t('pro.ct.col.season')}</th>
                <th className="py-1 pr-2 font-medium">{t('pro.ipl.franchise')}</th>
                <th className="py-1 pr-2 font-medium">M</th>
                <th className="py-1 pr-2 font-medium">{t('stats.runs')}</th>
                <th className="py-1 pr-2 font-medium">Wkts</th>
                <th className="py-1 pr-2 font-medium">{t('pro.ct.col.finish')}</th>
                <th className="py-1 font-medium">{t('pro.ipl.salary')}</th>
              </tr>
            </thead>
            <tbody>
              {[...ipl.seasons].reverse().map((s) => (
                <tr key={s.seasonYear} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-semibold text-ink">{s.seasonYear + 1}</td>
                  <td className="py-1.5 pr-2 text-ink">{FRANCHISES_BY_ID[s.franchiseId]?.short ?? '-'}</td>
                  <td className="py-1.5 pr-2 text-ink">{s.matches}/{s.teamMatches}</td>
                  <td className="py-1.5 pr-2 text-ink">{s.runs}</td>
                  <td className="py-1.5 pr-2 text-ink">{s.wickets}</td>
                  <td className="py-1.5 pr-2">{s.finish === 1 ? <Badge tone="gold">{t('pro.ct.champions')}</Badge> : s.finish === 2 ? t('pro.ct.runnersUp') : s.finish ? t('pro.ct.nth', { n: s.finish }) : '-'}</td>
                  <td className="py-1.5 text-ink">{formatLakh(s.salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/tournaments/ipl" className="mt-2 inline-block text-[13px] font-semibold text-brand-blue">{t('pro.ct.tableLink')}</Link>
      </Card>
    </div>
  );
}

function Franchises({ state }: { state: GameState }) {
  const t = useT();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {FRANCHISES.map((f) => {
        const team = state.teams[f.id];
        const squad = team?.squad ?? [];
        const overseas = squad.filter((p) => p.overseas).length;
        const stars = [...squad].sort((a, b) => rivalValue(b) - rivalValue(a)).slice(0, 3);
        return (
          <Card key={f.id} className={cn(state.pro.ipl.franchiseId === f.id && 'ring-2 ring-brand-blue')}>
            <div className="flex items-center gap-3">
              {team ? <Crest crest={team.crest} size={40} label={f.name} /> : null}
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{f.name}</p>
                <p className="text-[12px] text-ink-muted">{f.city} · {t(styleKey(f.style))} · {team ? state.venues[team.homeVenueId]?.name ?? '' : ''}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatTile label={t('pro.fr.squad')} value={squad.length ? `${squad.length}` : '-'} />
              <StatTile label={t('pro.overseas')} value={squad.length ? `${overseas}/${IPL_RULES.maxOverseasSquad}` : '-'} />
              <StatTile label={t('pro.fr.purse')} value={state.pro.ipl.purses[f.id] !== undefined ? formatLakh(state.pro.ipl.purses[f.id]) : '-'} />
            </div>
            {stars.length ? <p className="mt-2 text-[12px] text-ink-muted">{t('pro.fr.stars', { names: stars.map((p) => p.name).join(', ') })}</p> : null}
          </Card>
        );
      })}
    </div>
  );
}
