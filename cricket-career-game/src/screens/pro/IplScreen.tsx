import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Play } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, ProgressBar, StatTile, Tabs } from '@/components';
import { AUCTION, IPL_RULES } from '@/engine/config';
import { FRANCHISES, FRANCHISES_BY_ID } from '@/data/franchises';
import { allowedBases, auctionEntry, defaultBase, iplYearLabel, isMegaSeason, rivalValue } from '@/engine/pro/ipl';
import { activePosts } from '@/engine/pro/leadership';
import { roleGroup, ROLE_GROUP_LABEL } from '@/engine/career/squads';
import { IPL_STATUS_LABEL, formatLakh, franchiseName, marketValue } from '@/lib/pro';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { AuctionLot, AuctionSummary, GameState } from '@/types';

const TABS = [
  { id: 'scouting', label: 'Scouting' },
  { id: 'auction', label: 'Auction room' },
  { id: 'contract', label: 'Contract & seasons' },
  { id: 'franchises', label: 'Franchises' },
];

export default function IplScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Ipl state={state} />;
}

function Ipl({ state }: { state: GameState }) {
  const [tab, setTab] = useState(state.pro.ipl.auctions.length ? 'auction' : 'scouting');
  const ipl = state.pro.ipl;
  const senior = state.career.stages.SENIOR_STATE?.status === 'COMPLETED';
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">IPL</h1>
        <p className="text-[13px] text-ink-muted">
          The IPL is never automatic: scouts, franchise trials, the auction shortlist - and the room may still leave you unsold. {iplYearLabel(state.season.year)} auction: {isMegaSeason(state.season.year) ? 'mega auction (every franchise starts again)' : 'mini auction'}.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Scouting reputation" value={Math.round(state.pro.scouting.reputation)} />
        <StatTile label="Status" value={<span className="text-[13px]">{IPL_STATUS_LABEL[ipl.status]}</span>} />
        <StatTile label="Franchise" value={<span className="text-[13px]">{franchiseName(ipl.franchiseId)}</span>} />
        <StatTile label="Salary" value={ipl.contract ? formatLakh(ipl.contract.salary) : '-'} />
        <StatTile label="Market value" value={formatLakh(marketValue(state))} />
        <StatTile label="IPL earnings" value={formatLakh(ipl.earnings)} />
      </div>
      {!senior ? (
        <Card>
          <p className="text-[13px] text-ink-muted">
            Franchises only sign players with senior state cricket behind them. Until your senior debut the scouts just take notes - big days in the U-19 and U-23 competitions still count ({Math.round(state.pro.scouting.reputation)} so far).
          </p>
        </Card>
      ) : null}
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="IPL sections" />
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
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Scouting reputation" subtitle="What franchise scouts know and think of you, 0-100" className="mb-3" />
        <ProgressBar value={s.reputation} tone={s.reputation >= AUCTION.shortlistAt ? 'green' : s.reputation >= AUCTION.trialAt ? 'orange' : 'blue'} label="Scouting reputation" />
        <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-ink-muted">
          <span>{AUCTION.scoutedAt}: scouts in touch</span>
          <span>·</span>
          <span>{AUCTION.trialAt}: franchise trials</span>
          <span>·</span>
          <span>{AUCTION.shortlistAt}: auction shortlist</span>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          Built from the Syed Mushtaq Ali Trophy most of all, then the Vijay Hazare, India U-19 and U-23 cricket, and standout days (70 in a T20, four wickets). It fades by a fifth each season.
        </p>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Recent notes</h3>
        {s.notes.length === 0 ? <p className="text-[13px] text-ink-muted">Nothing in the scouts' notebooks yet.</p> : null}
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
        <CardHeader title="Franchise interest" subtitle="Your reputation, their needs in your role, and their style" className="mb-3" />
        <ul className="flex flex-col gap-2">
          {interest.map((f) => {
            const team = state.teams[f.id];
            return (
              <li key={f.id} className="flex items-center gap-2.5">
                {team ? <Crest crest={team.crest} size={26} label={f.name} /> : null}
                <span className="w-40 shrink-0 truncate text-[13px] text-ink">{f.name}</span>
                <ProgressBar value={s.interest[f.id] ?? 0} tone={(s.interest[f.id] ?? 0) >= AUCTION.trialAt ? 'green' : 'blue'} height={6} className="flex-1" label={`${f.name} interest`} />
                <span className="w-8 text-right text-[12px] font-semibold text-ink">{s.interest[f.id] ?? 0}</span>
              </li>
            );
          })}
        </ul>
        <h3 className="mt-4 mb-1 text-[13px] font-semibold text-ink">Franchise trials</h3>
        {s.trials.length === 0 ? <p className="text-[13px] text-ink-muted">No trials yet. Franchises hold trials in late November for the players their scouts rate.</p> : null}
        <ul className="flex flex-col gap-1">
          {s.trials.map((t) => (
            <li key={t.date} className="rounded-tile bg-page px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-ink">{franchiseName(t.franchiseId)}</span> · {formatLongDate(t.date)} · {t.bonus > 0 ? '+' : ''}{t.bonus}: <span className="text-ink-muted">{t.verdict}</span>
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
  return (
    <div className="flex flex-col gap-3">
      <Registration state={state} />
      {!summary ? (
        <Card>
          <p className="text-[13px] text-ink-muted">No auction yet. The auction is on 16 December; retention day (1 November) comes first.</p>
        </Card>
      ) : (
        <>
          {auctions.length > 1 ? (
            <Tabs tabs={auctions.map((a, i) => ({ id: String(i), label: `${a.mega ? 'Mega ' : ''}${a.seasonYear}` }))} value={String(index)} onChange={(v) => setIndex(Number(v))} label="Auctions" />
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
  if (state.pro.ipl.franchiseId || state.career.stages.SENIOR_STATE?.status !== 'COMPLETED') return null;
  return (
    <Card>
      <CardHeader title={`Auction registration - ${state.season.year}`} subtitle={entry.reason} className="mb-3" />
      <p className="mb-2 text-[12.5px] text-ink-muted">
        Your base price is the opening bid. Higher bands mean more money - and fewer franchises willing to start the bidding. Uncapped players top out at {formatLakh(AUCTION.uncappedMaxBase)}. Market value: {formatLakh(marketValue(state))}.
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
      {state.pro.ipl.registeredBase === null ? <p className="mt-2 text-[12px] text-ink-muted">Not chosen: your agent will register you at {formatLakh(chosen)}.</p> : null}
    </Card>
  );
}

function AuctionView({ state, summary }: { state: GameState; summary: AuctionSummary }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader
          title={`${summary.mega ? 'Mega auction' : 'IPL auction'} · ${formatLongDate(summary.date)}`}
          subtitle={`${iplYearLabel(summary.seasonYear)} · your status: ${IPL_STATUS_LABEL[summary.userStatus]}`}
          className="mb-3"
        />
        {summary.userLot ? <LiveLot lot={summary.userLot} reduceMotion={state.settings.reduceMotion} /> : <p className="text-[13px] text-ink-muted">You were not in this auction.</p>}
      </Card>
      <Card>
        <CardHeader title="The room" subtitle="Biggest buys" className="mb-2" />
        <ul className="flex flex-col gap-1">
          {summary.lots.filter((l) => !l.isUser).slice(0, 10).map((l) => (
            <li key={l.playerId} className="flex items-center justify-between gap-2 border-t border-line py-1.5 text-[12.5px]">
              <span className="min-w-0 truncate text-ink">
                {l.name} <span className="text-ink-muted">({ROLE_GROUP_LABEL[roleGroup(l.role as never)]}{l.overseas ? ', overseas' : ''}, {l.age})</span>
              </span>
              <span className="shrink-0 font-semibold text-ink">{l.price ? `${formatLakh(l.price)} → ${FRANCHISES_BY_ID[l.soldTo ?? '']?.short ?? ''}` : 'Unsold'}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Purses left</h3>
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
function LiveLot({ lot, reduceMotion }: { lot: AuctionLot; reduceMotion: boolean }) {
  const [shown, setShown] = useState(reduceMotion ? lot.bids.length : 0);
  const [run, setRun] = useState(!reduceMotion);
  useEffect(() => {
    if (!run) return;
    if (shown >= lot.bids.length) {
      setRun(false);
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 450);
    return () => clearTimeout(t);
  }, [run, shown, lot.bids.length]);
  const current = lot.bids[shown - 1];
  const done = shown >= lot.bids.length;
  const bidders = useMemo(() => [...new Set(lot.bids.map((b) => b.franchiseId))], [lot.bids]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-tile bg-brand-navy p-4 text-white">
        <Gavel className="size-8 text-brand-gold" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/70">Lot: you · base price {formatLakh(lot.basePrice)}</p>
          <p className="text-[24px] leading-tight font-bold">{current ? formatLakh(current.amount) : formatLakh(lot.basePrice)}</p>
          <p className="text-[13px] text-white/80">{current ? `${franchiseName(current.franchiseId)} hold the bid` : lot.bids.length ? 'Bidding opens…' : 'No bids'}</p>
        </div>
        {done ? (
          <Badge tone={lot.soldTo ? 'green' : 'red'}>{lot.soldTo ? `SOLD to ${franchiseName(lot.soldTo)}` : 'UNSOLD'}</Badge>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">{bidders.length} franchise{bidders.length === 1 ? '' : 's'} bid · {lot.bids.length} bids</p>
        <button type="button" onClick={() => { setShown(0); setRun(true); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
          <Play className="size-3.5" aria-hidden /> Replay
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
  const ipl = state.pro.ipl;
  const offer = ipl.tradeOffer;
  const posts = activePosts(state).filter((p) => p.level === 'IPL');
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Contract" subtitle={ipl.contract ? `${franchiseName(ipl.contract.franchiseId)} · ${ipl.contract.how.toLowerCase()}` : IPL_STATUS_LABEL[ipl.status]} className="mb-3" />
        {ipl.contract ? (
          <ul className="grid grid-cols-2 gap-2 text-[13px]">
            <li className="rounded-tile bg-page p-2">Salary<br /><span className="font-semibold text-ink">{formatLakh(ipl.contract.salary)} a season</span></li>
            <li className="rounded-tile bg-page p-2">Runs to<br /><span className="font-semibold text-ink">{iplYearLabel(ipl.contract.toSeason)} (next mega auction)</span></li>
            <li className="rounded-tile bg-page p-2">Signed<br /><span className="font-semibold text-ink">{ipl.contract.fromSeason}</span></li>
            <li className="rounded-tile bg-page p-2">Role<br /><span className="font-semibold text-ink">{posts[0] ? (posts[0].role === 'CAPTAIN' ? 'Captain' : 'Vice-captain') : 'Squad player'}</span></li>
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">No franchise. Build the reputation, register at the right price, and wait for the hammer.</p>
        )}
        <p className="mt-3 text-[12.5px] text-ink-muted">
          The franchise captain and coach pick the XI from the squad (four overseas players at most; an impact substitute {IPL_RULES.impactPlayer ? 'is' : 'is not'} used). Strong seasons raise your value, your retention deal and the national selectors' interest.
        </p>
        {offer ? (
          <div className="mt-3 rounded-tile border border-brand-blue bg-brand-blue-soft p-3">
            <p className="text-[13px] font-semibold text-ink">Trade offer: {franchiseName(offer.franchiseId)} ({formatLakh(offer.salary)})</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => answerTrade(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">Accept trade</button>
              <button type="button" onClick={() => answerTrade(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">Stay put</button>
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <CardHeader title="IPL seasons" action={{ label: 'Table', to: '/tournaments/ipl' }} className="mb-2" />
        {ipl.seasons.length === 0 ? <p className="text-[13px] text-ink-muted">No IPL seasons yet.</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[13px]">
            <thead className="text-[12px] text-ink-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">Season</th>
                <th className="py-1 pr-2 font-medium">Franchise</th>
                <th className="py-1 pr-2 font-medium">M</th>
                <th className="py-1 pr-2 font-medium">Runs</th>
                <th className="py-1 pr-2 font-medium">Wkts</th>
                <th className="py-1 pr-2 font-medium">Finish</th>
                <th className="py-1 font-medium">Salary</th>
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
                  <td className="py-1.5 pr-2">{s.finish === 1 ? <Badge tone="gold">Champions</Badge> : s.finish === 2 ? 'Runners-up' : s.finish ? `${s.finish}th` : '-'}</td>
                  <td className="py-1.5 text-ink">{formatLakh(s.salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/tournaments/ipl" className="mt-2 inline-block text-[13px] font-semibold text-brand-blue">This season's points table, NRR and playoffs</Link>
      </Card>
    </div>
  );
}

function Franchises({ state }: { state: GameState }) {
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
                <p className="text-[12px] text-ink-muted">{f.city} · {f.style.toLowerCase()} side · {team ? state.venues[team.homeVenueId]?.name ?? '' : ''}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatTile label="Squad" value={squad.length ? `${squad.length}` : '-'} />
              <StatTile label="Overseas" value={squad.length ? `${overseas}/${IPL_RULES.maxOverseasSquad}` : '-'} />
              <StatTile label="Purse" value={state.pro.ipl.purses[f.id] !== undefined ? formatLakh(state.pro.ipl.purses[f.id]) : '-'} />
            </div>
            {stars.length ? <p className="mt-2 text-[12px] text-ink-muted">Stars: {stars.map((p) => p.name).join(', ')}</p> : null}
          </Card>
        );
      })}
    </div>
  );
}
