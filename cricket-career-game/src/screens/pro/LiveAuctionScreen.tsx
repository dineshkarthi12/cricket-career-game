/**
 * The IPL auction, live: every lot in the order it came up, set by set, with
 * the paddles, the auctioneer, the purses and the squads moving as the
 * hammer falls. The auction itself was decided on its day (`runAuction`);
 * this is the room replayed, the way it is watched on television.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FastForward, Gavel, Pause, Play, SkipForward, Star, UserRound } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, Tabs } from '@/components';
import { FRANCHISES, FRANCHISES_BY_ID } from '@/data/franchises';
import { IPL_RULES } from '@/engine/config';
import { iplYearLabel } from '@/engine/pro/ipl';
import { daysBetweenDates } from '@/engine/development';
import { IPL_STATUS_LABEL, formatLakh, franchiseName } from '@/lib/pro';
import { formatLongDate, roleLabel } from '@/lib/format';
import { playSfx } from '@/lib/audio/player';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/store/appSettings';
import { useGameStore } from '@/store/gameStore';
import type { AuctionRoomLot, AuctionSummary, GameState, PlayerRole } from '@/types';

const SPEEDS = [1, 2, 4, 8];

/** Milliseconds at 1x for each moment of a lot. */
const PACE = {
  present: 1700,
  bid: 520,
  going: 750,
  result: 1900,
};

export default function LiveAuctionScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  const summary = state.pro.ipl.auctions.at(-1);
  if (!summary?.room?.length) {
    return (
      <Card>
        <CardHeader title="IPL auction - live" subtitle="Nothing to watch yet" className="mb-2" />
        <p className="text-[13px] text-ink-muted">The auction is held on 16 December every season. When the day comes the clock stops and the room opens here, lot by lot.</p>
        <Link to="/auction" className="mt-3 inline-block text-[13px] font-semibold text-brand-blue">Back to the IPL</Link>
      </Card>
    );
  }
  return <Room key={`${summary.seasonYear}-${summary.date}`} state={state} summary={summary} room={summary.room} />;
}

type Phase = 'present' | 'bid' | 'once' | 'twice' | 'silence' | 'sold' | 'unsold';

function phaseOf(lot: AuctionRoomLot, step: number): Phase {
  const b = lot.bids.length;
  if (step === 0) return 'present';
  if (step <= b) return 'bid';
  if (b === 0) return step === 1 ? 'silence' : 'unsold';
  return step === b + 1 ? 'once' : step === b + 2 ? 'twice' : 'sold';
}

function lastStep(lot: AuctionRoomLot): number {
  return lot.bids.length ? lot.bids.length + 3 : 2;
}

/** Uncapped, generated players at the base price: the room moves them through quickly. */
function quick(lot: AuctionRoomLot): boolean {
  return !lot.isUser && !lot.real && !lot.capped && (lot.price ?? 0) < 100;
}

function delay(lot: AuctionRoomLot, phase: Phase): number {
  const user = lot.isUser ? 1.8 : quick(lot) ? 0.4 : 1;
  if (phase === 'present') return PACE.present * user;
  if (phase === 'bid') return PACE.bid * (lot.isUser ? 1.6 : quick(lot) ? 0.5 : 1);
  if (phase === 'sold' || phase === 'unsold') return PACE.result * user;
  return PACE.going * user;
}

interface Books {
  purses: Record<string, number>;
  players: Record<string, number>;
  overseas: Record<string, number>;
}

/** Purses and squads when the room opened. */
function booksBefore(summary: AuctionSummary): Books {
  return {
    purses: { ...(summary.pursesBefore ?? {}) },
    players: Object.fromEntries(FRANCHISES.map((f) => [f.id, summary.squadsBefore?.[f.id]?.players ?? 0])),
    overseas: Object.fromEntries(FRANCHISES.map((f) => [f.id, summary.squadsBefore?.[f.id]?.overseas ?? 0])),
  };
}

/** Purses and squads after each lot. */
function booksAfter(summary: AuctionSummary, room: AuctionRoomLot[]): Books[] {
  const out: Books[] = [];
  let books = booksBefore(summary);
  for (const lot of room) {
    if (lot.soldTo && lot.price) {
      const t = lot.soldTo;
      books = {
        purses: { ...books.purses, [t]: (books.purses[t] ?? 0) - lot.price },
        players: { ...books.players, [t]: (books.players[t] ?? 0) + 1 },
        overseas: { ...books.overseas, [t]: (books.overseas[t] ?? 0) + (lot.overseas ? 1 : 0) },
      };
    }
    out.push(books);
  }
  return out;
}

function Room({ state, summary, room }: { state: GameState; summary: AuctionSummary; room: AuctionRoomLot[] }) {
  const navigate = useNavigate();
  const markWatched = useGameStore((s) => s.markAuctionWatched);
  const reduceMotion = useReducedMotion(state.settings.reduceMotion);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [over, setOver] = useState(false);

  const books = useMemo(() => booksAfter(summary, room), [summary, room]);
  const userIndex = room.findIndex((l) => l.isUser);
  const lot = room[index];
  const phase = phaseOf(lot, step);
  const done = step >= lastStep(lot);

  const finish = () => {
    setOver(true);
    setPlaying(false);
    markWatched();
  };
  const goTo = (i: number) => {
    if (i >= room.length) {
      finish();
      return;
    }
    setIndex(i);
    setStep(0);
  };

  // The clock of the room.
  useEffect(() => {
    if (!playing || over) return;
    const t = setTimeout(() => {
      if (step < lastStep(lot)) setStep(step + 1);
      else goTo(index + 1);
    }, delay(lot, phase) / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, over, index, step, speed]);

  // The crowd in the room when the hammer falls.
  useEffect(() => {
    if (phase !== 'sold' || speed > 2) return;
    if (lot.isUser) playSfx(['ROAR', 'APPLAUSE']);
    else if ((lot.price ?? 0) >= 1000) playSfx(['APPLAUSE']);
    else if ((lot.price ?? 0) >= 300) playSfx(['LIGHT_CLAP']);
  }, [phase, lot, speed]);
  useEffect(() => {
    if (phase === 'unsold' && lot.isUser && speed <= 2) playSfx(['GROAN']);
  }, [phase, lot, speed]);

  // The user's lot always plays at full speed.
  useEffect(() => {
    if (lot.isUser && step === 0) setSpeed(1);
  }, [lot.isUser, step]);

  if (over) return <Result state={state} summary={summary} room={room} onReplay={() => { setOver(false); setIndex(0); setStep(0); setPlaying(true); }} onLeave={() => navigate('/')} />;

  const shownBooks: Books = done ? books[index] : index > 0 ? books[index - 1] : booksBefore(summary);
  const sales = room.slice(0, done ? index + 1 : index).filter((l) => l.soldTo && l.price);
  const nextSet = room.findIndex((l, i) => i > index && l.set !== lot.set);
  const title = `${iplYearLabel(summary.seasonYear)} ${summary.mega ? 'Mega Auction' : 'Auction'}`;
  // A match the user was playing when the auction was held.
  const atMatch = Object.values(state.fixtures).find((f) => f.kind === 'MATCH' && f.involvesUser && f.date < summary.date && f.endDate >= summary.date);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] leading-tight font-bold text-ink">
            <span className="inline-flex items-center gap-1 rounded bg-brand-red px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
              <span className={cn('size-1.5 rounded-full bg-white', !reduceMotion && playing && 'animate-pulse')} /> Live
            </span>
            {title}
          </h1>
          <p className="text-[13px] text-ink-muted">
            {formatLongDate(summary.date)} · {room.length} lots · purse {formatLakh(Math.max(...Object.values(summary.pursesBefore ?? { x: 0 })))} at most · {IPL_RULES.squadSize} a squad, {IPL_RULES.maxOverseasSquad} overseas
          </p>
        </div>
        <Controls
          playing={playing}
          speed={speed}
          onPlay={() => setPlaying(!playing)}
          onSpeed={setSpeed}
          onNextLot={() => goTo(index + 1)}
          onNextSet={() => goTo(nextSet === -1 ? room.length : nextSet)}
          onMyLot={userIndex > index ? () => goTo(userIndex) : null}
          onEnd={finish}
        />
      </div>

      {atMatch ? (
        <p className="rounded-tile bg-brand-blue-soft px-3 py-2 text-[12.5px] text-ink">
          <span className="font-semibold">{atMatch.title}</span> was on when the room met (day {daysBetweenDates(atMatch.date, summary.date) + 1}) - the squad watches it together in the dressing room after stumps.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
        <Stage lot={lot} step={step} phase={phase} number={index + 1} total={room.length} reduceMotion={reduceMotion} user={state} />
        <Card>
          <CardHeader title="The ten franchises" subtitle="Purse left · squad · overseas" className="mb-2" />
          <ul className="flex flex-col gap-1">
            {[...FRANCHISES].sort((a, b) => (shownBooks.purses[b.id] ?? 0) - (shownBooks.purses[a.id] ?? 0)).map((f) => {
              const team = state.teams[f.id];
              const leading = phase !== 'present' && step > 0 && lot.bids[Math.min(step, lot.bids.length) - 1]?.franchiseId === f.id;
              const bought = done && lot.soldTo === f.id;
              const mine = state.pro.ipl.franchiseId === f.id;
              return (
                <li
                  key={f.id}
                  className={cn(
                    'flex items-center gap-2 rounded-tile px-2 py-1.5 text-[12.5px] transition-colors',
                    bought ? 'bg-brand-gold/25' : leading ? 'bg-brand-blue-soft' : 'bg-page',
                  )}
                >
                  {team ? <Crest crest={team.crest} size={22} label={f.name} /> : null}
                  <span className={cn('w-12 shrink-0 font-semibold', mine ? 'text-brand-blue' : 'text-ink')}>{f.short}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{f.city}</span>
                  <span className="w-16 text-right font-semibold text-ink tabular-nums">{formatLakh(Math.max(0, shownBooks.purses[f.id] ?? 0))}</span>
                  <span className="w-11 text-right text-ink-muted tabular-nums">{shownBooks.players[f.id] ?? 0}/{IPL_RULES.squadSize}</span>
                  <span className="w-9 text-right text-ink-muted tabular-nums">✈{shownBooks.overseas[f.id] ?? 0}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sold so far" subtitle={`${sales.length} player${sales.length === 1 ? "" : "s"} · ${formatLakh(sales.reduce((n, l) => n + (l.price ?? 0), 0))} spent`} className="mb-2" />
          {sales.length === 0 ? <p className="text-[13px] text-ink-muted">The first lot is under the hammer.</p> : null}
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {[...sales].reverse().slice(0, 30).map((l) => <SaleRow key={l.playerId} lot={l} />)}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Biggest buys" subtitle="So far in the room" className="mb-2" />
          {sales.length === 0 ? <p className="text-[13px] text-ink-muted">No sales yet.</p> : null}
          <ul className="flex flex-col gap-1">
            {[...sales].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 8).map((l, i) => <SaleRow key={l.playerId} lot={l} rank={i + 1} />)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Controls(props: {
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onSpeed: (s: number) => void;
  onNextLot: () => void;
  onNextSet: () => void;
  onMyLot: (() => void) | null;
  onEnd: () => void;
}) {
  const btn = 'inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-page';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={props.onPlay} className="inline-flex items-center gap-1 rounded-xl bg-brand-blue px-3 py-2 text-[12.5px] font-semibold text-white">
        {props.playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {props.playing ? 'Pause' : 'Play'}
      </button>
      <div className="flex overflow-hidden rounded-xl border border-line" role="group" aria-label="Speed">
        {SPEEDS.map((s) => (
          <button key={s} type="button" onClick={() => props.onSpeed(s)} aria-pressed={props.speed === s} className={cn('px-2.5 py-2 text-[12.5px] font-semibold', props.speed === s ? 'bg-brand-navy text-white' : 'bg-surface text-ink hover:bg-page')}>
            {s}x
          </button>
        ))}
      </div>
      <button type="button" onClick={props.onNextLot} className={btn}>
        <SkipForward className="size-3.5" aria-hidden /> Next lot
      </button>
      <button type="button" onClick={props.onNextSet} className={btn}>
        <FastForward className="size-3.5" aria-hidden /> Next set
      </button>
      {props.onMyLot ? (
        <button type="button" onClick={props.onMyLot} className="inline-flex items-center gap-1 rounded-xl bg-brand-gold px-3 py-2 text-[12.5px] font-bold text-brand-navy">
          <UserRound className="size-3.5" aria-hidden /> Jump to my lot
        </button>
      ) : null}
      <button type="button" onClick={props.onEnd} className={btn}>
        Results
      </button>
    </div>
  );
}

function auctioneer(lot: AuctionRoomLot, phase: Phase, step: number, number: number): string {
  const bid = lot.bids[Math.min(step, lot.bids.length) - 1];
  const holder = bid ? FRANCHISES_BY_ID[bid.franchiseId]?.name ?? '' : '';
  switch (phase) {
    case 'present':
      return `Lot ${number}. ${lot.name}, ${roleLabel(lot.role as PlayerRole).toLowerCase()}, base price ${formatLakh(lot.basePrice)}. Who will start?`;
    case 'bid':
      return step === 1 ? `${holder} open the bidding at ${formatLakh(bid.amount)}.` : `${formatLakh(bid.amount)} - with ${holder}.`;
    case 'once':
      return `${formatLakh(lot.price ?? 0)} with ${franchiseName(lot.soldTo)}… going once…`;
    case 'twice':
      return `Going twice… last chance at ${formatLakh(lot.price ?? 0)}…`;
    case 'sold':
      return `SOLD! ${lot.name} to ${franchiseName(lot.soldTo)} for ${formatLakh(lot.price ?? 0)}.`;
    case 'silence':
      return `${formatLakh(lot.basePrice)}… any paddles?… no takers in the room.`;
    case 'unsold':
      return `${lot.name} goes unsold.`;
  }
}

function Stage({ lot, step, phase, number, total, reduceMotion, user }: { lot: AuctionRoomLot; step: number; phase: Phase; number: number; total: number; reduceMotion: boolean; user: GameState }) {
  const bidsSoFar = lot.bids.slice(0, Math.min(step, lot.bids.length));
  const current = bidsSoFar.at(-1);
  const holder = current ? FRANCHISES_BY_ID[current.franchiseId] : null;
  const inBidding = new Set(bidsSoFar.map((b) => b.franchiseId));
  const sold = phase === 'sold';
  const unsold = phase === 'unsold';
  const colors = sold && lot.soldTo ? FRANCHISES_BY_ID[lot.soldTo]?.colors : holder?.colors;
  const photoInitials = lot.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card flush className={cn('overflow-hidden', lot.isUser && 'ring-4 ring-brand-gold')}>
      <div className="relative bg-brand-navy px-5 pt-4 pb-5 text-white" aria-live="polite">
        {colors ? <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})` }} /> : null}
        <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold tracking-wide text-brand-gold uppercase">
          <span>{lot.set}</span>
          <span className="text-white/60">Lot {number} of {total}</span>
        </div>
        {lot.isUser ? (
          <p className={cn('mt-2 rounded-tile bg-brand-gold px-3 py-1.5 text-center text-[13px] font-bold text-brand-navy', !reduceMotion && phase === 'present' && 'animate-pulse')}>
            Your name is up! {user.player.firstName}, this is your lot.
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-brand-gold/70 bg-white/10 text-[20px] font-bold">{photoInitials}</div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[24px] leading-tight font-bold">
              {lot.name}
              {lot.real && lot.capped && lot.overall >= 80 ? <Star className="size-4 shrink-0 fill-brand-gold text-brand-gold" aria-label="Star" /> : null}
            </p>
            <p className="text-[13px] text-white/80">
              {roleLabel(lot.role as PlayerRole)} · {lot.age} · {lot.from} {lot.overseas ? '✈' : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded bg-white/15 px-2 py-0.5">{lot.capped ? 'Capped' : 'Uncapped'}</span>
              {lot.overseas ? <span className="rounded bg-white/15 px-2 py-0.5">Overseas</span> : null}
              <span className="rounded bg-white/15 px-2 py-0.5">T20 rating {lot.overall}</span>
              <span className="rounded bg-white/15 px-2 py-0.5">Base {formatLakh(lot.basePrice)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-white/60">{sold ? 'Sold for' : current ? 'Current bid' : 'Base price'}</p>
            <p className={cn('text-[38px] leading-none font-extrabold text-brand-gold tabular-nums', !reduceMotion && phase === 'bid' && 'transition-transform')}>
              {formatLakh(sold ? lot.price ?? 0 : current?.amount ?? lot.basePrice)}
            </p>
            <p className="mt-1 text-[13px] text-white/85">{sold ? `to ${franchiseName(lot.soldTo)}` : holder ? `${holder.name} hold the bid` : unsold ? 'No bids' : 'Waiting for a paddle'}</p>
          </div>
          {sold || unsold ? (
            <div className={cn('flex items-center gap-2 rounded-tile px-4 py-2 text-[22px] font-extrabold tracking-wide', sold ? 'bg-brand-green text-white' : 'bg-brand-red text-white', !reduceMotion && 'animate-bounce')}>
              <Gavel className="size-6" aria-hidden />
              {sold ? 'SOLD' : 'UNSOLD'}
            </div>
          ) : phase === 'once' || phase === 'twice' ? (
            <p className="rounded-tile bg-white/10 px-3 py-2 text-[16px] font-bold">{phase === 'once' ? 'Going once…' : 'Going twice…'}</p>
          ) : null}
        </div>
        <p className="mt-4 rounded-tile bg-white/10 px-3 py-2 text-[13px] text-white/90 italic">
          <span className="font-semibold not-italic text-brand-gold">Auctioneer: </span>
          {auctioneer(lot, phase, step, number)}
        </p>
      </div>

      <div className="px-5 py-3">
        <p className="mb-2 text-[12px] font-semibold text-ink-muted">Paddles</p>
        <div className="flex flex-wrap gap-1.5">
          {FRANCHISES.map((f) => {
            const active = inBidding.has(f.id);
            const leads = (sold ? lot.soldTo : current?.franchiseId) === f.id;
            return (
              <span
                key={f.id}
                className={cn('rounded-full border px-2.5 py-1 text-[11.5px] font-bold', leads ? 'border-transparent text-white' : active ? 'border-ink/30 text-ink' : 'border-line text-ink-muted/60')}
                style={leads ? { background: f.colors[0] } : undefined}
              >
                {f.short}
              </span>
            );
          })}
        </div>
        {bidsSoFar.length ? (
          <ol className="mt-3 flex max-h-36 flex-col gap-1 overflow-y-auto text-[12.5px]" aria-label="Bids on this lot">
            {[...bidsSoFar].reverse().map((b, i) => (
              <li key={bidsSoFar.length - i} className={cn('flex justify-between rounded px-3 py-1', i === 0 ? 'bg-brand-blue-soft font-semibold' : 'bg-page')}>
                <span className="text-ink">{franchiseName(b.franchiseId)}</span>
                <span className="text-ink tabular-nums">{formatLakh(b.amount)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Card>
  );
}

function SaleRow({ lot, rank }: { lot: AuctionRoomLot; rank?: number }) {
  const f = FRANCHISES_BY_ID[lot.soldTo ?? ''];
  return (
    <li className={cn('flex items-center gap-2 rounded-tile px-2.5 py-1.5 text-[12.5px]', lot.isUser ? 'bg-brand-gold/25' : 'bg-page')}>
      {rank ? <span className="w-5 font-bold text-ink-muted">{rank}</span> : null}
      <span className="min-w-0 flex-1 truncate text-ink">
        <span className="font-semibold">{lot.name}</span> <span className="text-ink-muted">· {roleLabel(lot.role as PlayerRole).toLowerCase()}{lot.overseas ? ' ✈' : ''}</span>
      </span>
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: f?.colors[0] ?? '#888' }}>{f?.short}</span>
      <span className="w-16 shrink-0 text-right font-semibold text-ink tabular-nums">{formatLakh(lot.price ?? 0)}</span>
    </li>
  );
}

function Result({ state, summary, room, onReplay, onLeave }: { state: GameState; summary: AuctionSummary; room: AuctionRoomLot[]; onReplay: () => void; onLeave: () => void }) {
  const [team, setTeam] = useState(state.pro.ipl.franchiseId ?? summary.userLot?.soldTo ?? FRANCHISES[0].id);
  const sold = room.filter((l) => l.soldTo && l.price);
  const unsold = room.filter((l) => !l.soldTo);
  const user = summary.userLot;
  const buys = sold.filter((l) => l.soldTo === team).sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  const squad = state.teams[team]?.squad ?? [];
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{iplYearLabel(summary.seasonYear)} {summary.mega ? 'Mega Auction' : 'Auction'}: the results</h1>
        <p className="text-[13px] text-ink-muted">
          {sold.length} sold · {unsold.length} unsold · {formatLakh(sold.reduce((n, l) => n + (l.price ?? 0), 0))} spent
        </p>
      </div>
      <Card className={cn(user?.soldTo ? 'ring-2 ring-brand-gold' : '')}>
        <div className="flex flex-wrap items-center gap-3">
          <Gavel className="size-8 text-brand-gold" aria-hidden />
          <div className="min-w-0 flex-1">
            {user ? (
              user.soldTo ? (
                <>
                  <p className="text-[18px] font-bold text-ink">SOLD to {franchiseName(user.soldTo)} for {formatLakh(user.price ?? 0)}!</p>
                  <p className="text-[13px] text-ink-muted">
                    Base price {formatLakh(user.basePrice)} · {user.bids.length} bids from {new Set(user.bids.map((b) => b.franchiseId)).size} franchises. The franchise camp starts in March.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[18px] font-bold text-ink">Unsold at {formatLakh(user.basePrice)}</p>
                  <p className="text-[13px] text-ink-muted">It happens to good players. Injuries bring replacement signings before and during the season - stay ready.</p>
                </>
              )
            ) : (
              <>
                <p className="text-[16px] font-bold text-ink">You were not in this auction</p>
                <p className="text-[13px] text-ink-muted">Your status: {IPL_STATUS_LABEL[summary.userStatus]}.</p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onReplay} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-page">Watch again</button>
            <button type="button" onClick={onLeave} className="rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy">Back to the career</button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Biggest buys" className="mb-2" />
          <ul className="flex flex-col gap-1">
            {[...sold].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 12).map((l, i) => <SaleRow key={l.playerId} lot={l} rank={i + 1} />)}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Squads after the auction" subtitle="Bought in the room, and the full squad" className="mb-2" />
          <Tabs tabs={FRANCHISES.map((f) => ({ id: f.id, label: f.short }))} value={team} onChange={setTeam} label="Franchise" />
          <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-muted">
            {state.teams[team] ? <Crest crest={state.teams[team].crest} size={26} label={franchiseName(team)} /> : null}
            <span className="font-semibold text-ink">{franchiseName(team)}</span>
            <span>· {squad.length} players · {squad.filter((p) => p.overseas).length} overseas · purse left {formatLakh(summary.pursesAfter[team] ?? 0)}</span>
          </div>
          <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Bought in the room ({buys.length})</h3>
          {buys.length === 0 ? <p className="text-[13px] text-ink-muted">No buys.</p> : null}
          <ul className="flex flex-col gap-1">
            {buys.map((l) => <SaleRow key={l.playerId} lot={l} />)}
          </ul>
          <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Full squad</h3>
          <div className="flex flex-wrap gap-1.5">
            {[...squad].sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0)).map((p) => (
              <Badge key={p.id} tone={p.overseas ? 'blue' : 'grey'} className="px-2 py-0.5 text-[11.5px]">
                {p.name} · {formatLakh(p.salary ?? 20)}
              </Badge>
            ))}
            {state.pro.ipl.franchiseId === team ? <Badge tone="gold" className="px-2 py-0.5 text-[11.5px]">{state.player.firstName} {state.player.lastName} (you)</Badge> : null}
          </div>
        </Card>
      </div>
      {unsold.length ? (
        <Card>
          <CardHeader title="Unsold" subtitle="No franchise bid at their base price" className="mb-2" />
          <p className="text-[12.5px] text-ink-muted">{unsold.slice(0, 40).map((l) => `${l.name} (${formatLakh(l.basePrice)})`).join(', ')}{unsold.length > 40 ? ` and ${unsold.length - 40} more` : ''}.</p>
        </Card>
      ) : null}
    </div>
  );
}
