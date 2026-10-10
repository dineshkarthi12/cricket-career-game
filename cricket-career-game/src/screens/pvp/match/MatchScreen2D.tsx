/**
 * The live PvP match, played the Career Mode way: the 2D ground with the
 * fielders and the ball's path, the score strip, scorecard and commentary,
 * and the same controls - a batting aggression bar, and a bowling plan
 * (delivery, line, length, aggression) for whoever has the ball.
 *
 * Every control sends a request to the authority; nothing here decides an
 * outcome. The screen only draws the authority's events.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Flag, Loader2, Pause, Play, Timer, Trophy } from 'lucide-react';
import { Card, ConfirmDialog, Tabs } from '@/components';
import { LENGTHS, LINES, type DeliveryType } from '@/engine/pvp/match';
import { PVP_FORMAT } from '@/engine/pvp/config';
import type { DeliveryLength, DeliveryLine } from '@/types';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/pvp/backend';
import { usePvpStore } from '@/store/pvpStore';
import { useGameStore } from '@/store/gameStore';
import { sfxForBall } from '@/lib/audio/calls';
import { playSfx, startAmbience, stopAmbience } from '@/lib/audio/player';
import { AggressionBar } from '@/screens/match/controls/AggressionBar';
import { GroundView } from '@/screens/match/ground/GroundView';
import { CommentaryFeed } from '@/screens/match/panels/CommentaryFeed';
import { Scorecard } from '@/screens/match/panels/Scorecard';
import { ModeBadge } from '../PvpShell';
import { useLang, useT } from '@/i18n/react';
import { bowlingStyleLabel } from '../labels';
import type { Key } from '@/i18n/core';
import { summaryText } from '@/lib/matchText';
import { deriveCareerView, sideId } from './careerView';
import { chase, deriveView, overs, runRate } from './view';

/** Line and length names: the Career Mode ones, except two the PvP screen words its own way. */
const LINE_LABEL: Record<DeliveryLine, Key> = { WIDE_OFF: 'pvp.line.WIDE_OFF', OUTSIDE_OFF: 'line.OUTSIDE_OFF', OFF_STUMP: 'line.OFF_STUMP', MIDDLE: 'line.MIDDLE', LEG_STUMP: 'line.LEG_STUMP', DOWN_LEG: 'line.DOWN_LEG' };
const LENGTH_LABEL: Record<DeliveryLength, Key> = { YORKER: 'len.YORKER', FULL: 'len.FULL', GOOD: 'len.GOOD', SHORT_OF_GOOD: 'pvp.len.SHORT_OF_GOOD', SHORT: 'len.SHORT', FULL_TOSS: 'len.FULL_TOSS' };
const deliveryKey = (type: DeliveryType) => `pvp.del.${type}` as Key;

/** How long the ground takes to draw one ball, ms. */
const BALL_MS = 900;



const PREFS_KEY = 'cc26-pvp-2d-prefs';
interface Prefs {
  batLevel: number;
  bowlLevel: number;
  autoBat: boolean;
}
const DEFAULT_PREFS: Prefs = { batLevel: 3, bowlLevel: 3, autoBat: true };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // A preference that cannot be stored just lasts for this match.
  }
}

export default function MatchScreen2D() {
  const match = usePvpStore((s) => s.match);
  const backend = usePvpStore((s) => s.backend);
  const sendAction = usePvpStore((s) => s.sendAction);
  const leaveMatch = usePvpStore((s) => s.leaveMatch);
  const startPractice = usePvpStore((s) => s.startPractice);
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const sent = useRef(new Set<string>());
  const [prefs, setPrefs] = useState(loadPrefs);
  const [tab, setTab] = useState('commentary');
  const [paused, setPaused] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // The ball the ground is still drawing: the next delivery waits for it.
  const [drawingUntil, setDrawingUntil] = useState(0);

  const events = useMemo(() => match?.events ?? [], [match?.events]);
  const view = useMemo(() => deriveView(events), [events]);
  const career = useMemo(() => deriveCareerView(events), [events]);
  const mySide = match?.mySide ?? 0;
  const theirSide = (1 - mySide) as 0 | 1;
  const myTurn = view.actor === mySide;
  const batting = view.battingSide === mySide;

  const updatePrefs = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const lastBallId = career.lastBall?.id ?? null;
  useEffect(() => {
    if (lastBallId) setDrawingUntil(Date.now() + BALL_MS);
  }, [lastBallId]);
  const drawing = now < drawingUntil;

  // Sound, as in a career match: each ball gets its effects, the crowd murmurs
  // while play is on, and the result gets a last cheer. Nothing replays for
  // balls already bowled when the screen opens.
  const heard = useRef(lastBallId);
  useEffect(() => {
    const ball = career.lastBall;
    if (!ball || heard.current === ball.id) return;
    heard.current = ball.id;
    const inn = career.innings.find((i) => i.deliveries.some((d) => d.id === ball.id));
    if (inn) playSfx(sfxForBall(ball, inn, null));
  }, [career]);
  const ended = Boolean(view.end);
  const won = view.end?.result.winner === mySide;
  const resultHeard = useRef(ended);
  useEffect(() => {
    if (!ended || resultHeard.current) return;
    resultHeard.current = true;
    const timer = window.setTimeout(() => playSfx(won ? ['APPLAUSE', 'ROAR'] : ['LIGHT_CLAP']), 1200);
    return () => window.clearTimeout(timer);
  }, [ended, won]);
  useEffect(() => {
    if (!ended && !paused && match) startAmbience();
    else stopAmbience();
  }, [ended, paused, match]);
  useEffect(() => () => stopAmbience(), []);

  const send = useCallback(
    async (key: string, action: Parameters<typeof sendAction>[0]) => {
      if (sent.current.has(key)) return;
      sent.current.add(key);
      const r = await sendAction(action);
      if (!r.ok) {
        sent.current.delete(key);
        useGameStore.getState().pushToast({ tone: 'error', message: r.message });
      }
    },
    [sendAction],
  );

  const togglePause = useCallback(
    (to?: boolean) => {
      if (!backend?.pausable) return;
      setPaused((p) => {
        const next = to ?? !p;
        backend.setPaused?.(next);
        return next;
      });
    },
    [backend],
  );
  useEffect(() => () => backend?.setPaused?.(false), [backend]);

  const play = useCallback(
    (level: number) => {
      const rel = view.released;
      if (!rel || !myTurn || view.phase !== 'AWAIT_BAT' || paused) return;
      void send(`play:${rel.deliveryId}`, { type: 'PLAY', actionId: newRequestId('play'), deliveryId: rel.deliveryId, level });
    },
    [view.released, view.phase, myTurn, paused, send],
  );

  // Career-style batting: the set aggression plays each ball as it arrives.
  useEffect(() => {
    if (prefs.autoBat && view.phase === 'AWAIT_BAT' && myTurn) play(prefs.batLevel);
  }, [prefs.autoBat, prefs.batLevel, view.phase, myTurn, play]);

  if (!match) return <Navigate to="/pvp" replace />;

  const sides = view.sides;
  const me = sides?.[mySide];
  const them = sides?.[theirSide];
  const battingSide = sides?.[view.battingSide];
  const bowlingSide = sides?.[(1 - view.battingSide) as 0 | 1];
  const countdown = view.deadlineAt && backend ? Math.max(0, Math.ceil((view.deadlineAt - backend.serverNow()) / 1000)) : null;
  const totalBalls = (view.start?.overs ?? PVP_FORMAT.overs) * 6;
  const need = chase(view.score, totalBalls);
  const nameOf = (id: string | null) => (id ? view.players.get(id)?.name ?? '—' : '—');
  const striker = view.strikerId ? view.players.get(view.strikerId) : undefined;
  const bowler = view.bowlerId ? view.players.get(view.bowlerId) : undefined;
  const sFig = view.strikerId ? view.batters.get(view.strikerId) : undefined;
  const nFig = view.nonStrikerId ? view.batters.get(view.nonStrikerId) : undefined;
  const bFig = view.bowlerId ? view.bowlers.get(view.bowlerId) : undefined;
  const current = career.innings[career.innings.length - 1];
  const earlier = career.innings.slice(0, -1);
  const teamName = (id: string) => (id === sideId(0) ? sides?.[0].displayName : sides?.[1].displayName) ?? '…';

  const quit = () => {
    if (!view.end) void send('forfeit', { type: 'FORFEIT', actionId: newRequestId('ff') });
    togglePause(false);
    leaveMatch();
    navigate('/pvp');
  };

  return (
    <div className="min-h-dvh bg-page text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-3 sm:p-5">
        {/* Top bar */}
        <header className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="truncate text-[16px] font-bold text-brand-navy">
              {me?.displayName ?? t('m.you')} <span className="text-ink-soft">v</span> {them?.displayName ?? '…'}
            </p>
            <p className="truncate text-[12px] text-ink-muted">
              {t(match.mode === 'PRACTICE' ? 'pvp.mode.PRACTICE' : match.mode === 'RANKED' ? 'pvp.mode.RANKED' : 'pvp.mode.PRIVATE')} · {t('pvp.m.format', { n: totalBalls / 6 })} · {view.start?.venue ?? ''}
            </p>
          </div>
          <ModeBadge />
          {backend?.pausable ? (
            <button type="button" onClick={() => togglePause()} className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[13px] font-semibold shadow-sm ring-1 ring-line">
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? t('pvp.m.resume') : t('sim.pause')}
            </button>
          ) : null}
          <button type="button" onClick={() => (view.end ? quit() : setConfirmQuit(true))} className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[13px] font-semibold text-brand-red shadow-sm ring-1 ring-line">
            <Flag className="size-4" />
            {t(view.end ? 'pvp.m.leave' : 'pvp.m.forfeit')}
          </button>
        </header>

        {/* Score strip */}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">
                {battingSide?.displayName ?? '…'} <span className="text-ink-soft">v {bowlingSide?.displayName ?? '…'}</span>
              </p>
              <p className="text-[30px] leading-none font-bold text-ink">
                {view.score.runs}
                <span className="text-ink-soft">/</span>
                {view.score.wickets}
                <span className="ml-2 text-[16px] font-semibold text-ink-muted">({overs(view.score.balls)})</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span>
                <span className="text-ink-muted">CRR</span> <b>{runRate(view.score.runs, view.score.balls).toFixed(2)}</b>
              </span>
              {need ? (
                <>
                  <span>
                    <span className="text-ink-muted">{t('strip.target')}</span> <b>{view.score.target}</b>
                  </span>
                  <span>
                    <span className="text-ink-muted">RRR</span> <b>{need.rate.toFixed(2)}</b>
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {need ? (
            <p className="rounded-lg bg-brand-blue-soft px-3 py-1.5 text-[13px] font-semibold text-brand-blue">
              {t(need.balls === 1 ? 'pvp.m.need.one' : 'pvp.m.need.many', { n: need.need, b: need.balls })}
            </p>
          ) : null}
          <div className="grid gap-2 text-[13px] sm:grid-cols-3">
            <p className="truncate">
              <b>{nameOf(view.strikerId)}*</b> {sFig ? `${sFig.runs} (${sFig.balls})` : ''}
            </p>
            <p className="truncate text-ink-muted">
              {nameOf(view.nonStrikerId)} {nFig ? `${nFig.runs} (${nFig.balls})` : ''}
            </p>
            <p className="truncate">
              <span className="font-semibold">{bowler?.name ?? '—'}</span>{' '}
              <span className="text-ink-muted">{bFig ? `${overs(bFig.balls)}-${bFig.runs}-${bFig.wickets}` : ''}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1" aria-label={t('pvp.m.thisOver')}>
            <span className="mr-1 text-[11px] font-semibold text-ink-muted uppercase">{t('pvp.m.thisOver')}</span>
            {view.thisOver.map((b, i) => (
              <span
                key={i}
                className={cn(
                  'grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] font-bold',
                  b === 'W' ? 'bg-brand-red text-white' : b === '6' ? 'bg-brand-gold text-brand-navy' : b === '4' ? 'bg-brand-green text-white' : b.startsWith('w') || b.startsWith('n') ? 'bg-brand-orange/20 text-brand-orange' : b === '•' ? 'bg-page text-ink-soft' : 'bg-brand-blue-soft text-brand-blue',
                )}
              >
                {b}
              </span>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Card flush className="overflow-hidden">
              <GroundView
                venue={career.venue}
                conditions={career.conditions}
                field={career.field}
                ball={career.lastBall}
                leftHanded={striker?.battingStyle === 'LEFT_HAND_BAT'}
                userId={null}
                bowlerId={view.bowlerId}
                batters={view.strikerId && view.nonStrikerId ? { strikerId: view.strikerId, nonStrikerId: view.nonStrikerId, labelOf: (id) => nameOf(id).split(' ').slice(-1)[0] } : null}
                leftArmBowler={Boolean(bowler?.bowlingStyle.startsWith('LEFT_ARM'))}
                durationMs={BALL_MS}
                reduceMotion={false}
                className="aspect-square max-h-[520px] w-full"
              />
              {career.lastBall ? <p className="border-t border-line px-4 py-2.5 text-[13px]" aria-live="polite">{career.lastBall.commentary}</p> : null}
            </Card>

            {/* Your controls */}
            <Card className="flex flex-col gap-4">
              {view.phase === 'LOADING' ? <Waiting text={t('pvp.m.setup')} /> : null}
              {view.end ? null : batting ? (
                <BatControls
                  level={prefs.batLevel}
                  autoBat={prefs.autoBat}
                  onLevel={(batLevel) => updatePrefs({ batLevel })}
                  onAuto={(autoBat) => updatePrefs({ autoBat })}
                  canPlay={view.phase === 'AWAIT_BAT' && myTurn && !paused}
                  onPlay={() => play(prefs.batLevel)}
                  status={
                    view.phase === 'SELECT_BOWLER'
                      ? t('pvp.m.choosing', { name: them?.displayName ?? t('pvp.m.opponent') })
                      : view.phase === 'AWAIT_BOWL'
                        ? t('pvp.m.runningIn', { name: bowler?.name ?? t('pvp.m.theBowler') })
                        : view.phase === 'AWAIT_BAT'
                          ? t('pvp.m.onWay', { ball: view.released ? t(deliveryKey(view.released.deliveryType)) : t('pvp.m.ball'), name: striker?.name ?? t('pvp.m.yourBatter') })
                          : t('pvp.m.next')
                  }
                  countdown={view.phase === 'AWAIT_BAT' ? null : countdown}
                />
              ) : view.phase === 'SELECT_BOWLER' && view.bowlerNeeded && myTurn ? (
                <section>
                  <Heading title={t('pvp.m.chooseBowler', { n: view.bowlerNeeded.over + 1 })} countdown={countdown} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {view.bowlerNeeded.eligible.map((id) => {
                      const p = view.players.get(id)!;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => void send(`sel:${view.bowlerNeeded!.seq}`, { type: 'SELECT_BOWLER', actionId: newRequestId('sel'), bowlerId: id })}
                          className="rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-brand-blue-soft"
                        >
                          <span className="block text-[13px] font-bold">{p.name}</span>
                          <span className="block text-[11.5px] text-ink-muted">
                            {p.overall} · {bowlingStyleLabel(t, lang, p.bowlingStyle)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11.5px] text-ink-muted">{t('pvp.m.bowlRule')}</p>
                </section>
              ) : view.phase === 'AWAIT_BOWL' && view.open && myTurn ? (
                <BowlControls
                  key={view.open.bowlerId}
                  allowed={view.open.allowed}
                  title={t('pvp.m.to', { a: nameOf(view.open.bowlerId), b: nameOf(view.open.strikerId) })}
                  level={prefs.bowlLevel}
                  onLevel={(bowlLevel) => updatePrefs({ bowlLevel })}
                  countdown={paused ? null : countdown}
                  waiting={drawing}
                  onBowl={(type, line, length) =>
                    void send(`bowl:${view.open!.deliveryId}`, { type: 'BOWL', actionId: newRequestId('bowl'), deliveryId: view.open!.deliveryId, deliveryType: type, line, length, aggression: prefs.bowlLevel })
                  }
                />
              ) : (
                <Waiting
                  text={
                    view.phase === 'SELECT_BOWLER'
                      ? t('pvp.m.choosingAny')
                      : view.phase === 'AWAIT_BAT'
                        ? t('pvp.m.batting', { name: them?.displayName ?? t('pvp.m.opponent') })
                        : t('pvp.m.next')
                  }
                  countdown={countdown}
                />
              )}
            </Card>
          </div>

          <Card className="flex min-h-[360px] flex-col gap-3">
            <Tabs
              tabs={[
                { id: 'scorecard', label: t('play.tab.scorecard') },
                { id: 'commentary', label: t('play.tab.commentary') },
              ]}
              value={tab}
              onChange={setTab}
              label={t('pvp.m.panels')}
            />
            {current ? (
              tab === 'scorecard' ? (
                <div className="flex flex-col gap-6">
                  {[...career.innings].reverse().map((inn) => (
                    <Scorecard key={inn.id} innings={inn} battingTeam={teamName(inn.battingTeamId)} bowlingTeam={teamName(inn.bowlingTeamId)} strikerId={inn === current ? view.strikerId : null} />
                  ))}
                </div>
              ) : (
                <CommentaryFeed deliveries={current.deliveries} innings={current} battingTeam={teamName(current.battingTeamId)} earlier={earlier} />
              )
            ) : (
              <p className="text-[13px] text-ink-muted">{t('pvp.m.firstBall')}</p>
            )}
          </Card>
        </div>
      </div>

      {paused ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-brand-navy/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xs rounded-card bg-surface p-5 text-center shadow-card">
            <p className="text-[18px] font-extrabold">{t('pvp.m.paused')}</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">{t('pvp.m.clock')}</p>
            <button type="button" onClick={() => togglePause(false)} className="mt-4 w-full rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white">
              {t('pvp.m.resume')}
            </button>
          </div>
        </div>
      ) : null}

      {view.end && !drawing ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-brand-navy/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-surface p-6 text-center shadow-card">
            <Trophy className={cn('mx-auto size-10', view.end.result.winner === mySide ? 'text-brand-gold' : 'text-ink-soft')} aria-hidden />
            <p className="mt-2 text-[22px] font-extrabold">{t(view.end.result.winner === null ? 'pvp.m.tied' : view.end.result.winner === mySide ? 'pvp.m.won' : 'pvp.m.lost')}</p>
            <p className="mt-1 text-[14px] text-ink-muted">{summaryText(view.end.result.summary)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
              {view.end.result.scores.map((s, i) => (
                <div key={i} className="rounded-tile bg-page p-2">
                  <p className="truncate font-semibold">{sides?.[i].displayName}</p>
                  <p className="text-[18px] font-bold">
                    {s.runs}/{s.wickets} <span className="text-[12px] text-ink-muted">({overs(s.balls)})</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-ink-muted">{t(match.mode === 'RANKED' ? 'pvp.m.rankedDone' : 'pvp.m.rewards')}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={quit} className="rounded-xl bg-brand-blue-soft px-4 py-2 text-[14px] font-semibold text-brand-blue">
                {t('pvp.m.back')}
              </button>
              {match.mode === 'PRACTICE' ? (
                <button
                  type="button"
                  onClick={async () => {
                    leaveMatch();
                    const id = await startPractice();
                    if (!id) navigate('/pvp');
                  }}
                  className="rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white"
                >
                  {t('pvp.m.again')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmQuit}
        title={t('pvp.m.forfeitQ')}
        message={t(match.mode === 'RANKED' ? 'pvp.m.forfeitRanked' : 'pvp.m.forfeitLose')}
        confirmLabel={t('pvp.m.forfeit')}
        danger
        onConfirm={quit}
        onCancel={() => setConfirmQuit(false)}
      />
    </div>
  );
}

function Heading({ title, countdown }: { title: string; countdown?: number | null }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="truncate text-[15px] font-bold text-brand-navy">{title}</h2>
      {countdown !== null && countdown !== undefined ? (
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', countdown <= 5 ? 'bg-brand-red text-white' : 'bg-page text-ink')}>
          <Timer className="size-3.5" aria-hidden />
          {countdown}s
        </span>
      ) : null}
    </div>
  );
}

function Waiting({ text, countdown }: { text: string; countdown?: number | null }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-ink-muted" aria-live="polite">
      <Loader2 className="size-4 shrink-0 animate-spin text-brand-blue" aria-hidden />
      <span className="truncate">{text}</span>
      {countdown ? <span>({countdown}s)</span> : null}
    </p>
  );
}

function BatControls({
  level,
  autoBat,
  onLevel,
  onAuto,
  canPlay,
  onPlay,
  status,
  countdown,
}: {
  level: number;
  autoBat: boolean;
  onLevel: (level: number) => void;
  onAuto: (on: boolean) => void;
  canPlay: boolean;
  onPlay: () => void;
  status: string;
  countdown: number | null;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4">
      <AggressionBar label={t('batc.yourAgg')} kind="batting" level={level} hotkeys onChange={(next) => next !== null && onLevel(next)} />
      <label className="flex items-center justify-between gap-3 text-[13px] font-semibold">
        <span>
          {t('pvp.m.autoBat')}
          <span className="block text-[11.5px] font-normal text-ink-muted">{t('pvp.m.autoBatHint')}</span>
        </span>
        <input type="checkbox" checked={autoBat} onChange={(e) => onAuto(e.target.checked)} className="size-5 accent-brand-blue" />
      </label>
      {autoBat ? null : (
        <button type="button" disabled={!canPlay} onClick={onPlay} className="rounded-xl bg-brand-blue px-4 py-3 text-[15px] font-bold text-white disabled:opacity-45">
          {t('pvp.m.playBall')}
        </button>
      )}
      <Waiting text={status} countdown={countdown} />
    </section>
  );
}

function BowlControls({
  allowed,
  title,
  level,
  onLevel,
  countdown,
  waiting,
  onBowl,
}: {
  allowed: DeliveryType[];
  title: string;
  level: number;
  onLevel: (level: number) => void;
  countdown: number | null;
  /** The last ball is still being drawn. */
  waiting: boolean;
  onBowl: (t: DeliveryType, l: DeliveryLine, len: DeliveryLength) => void;
}) {
  const t = useT();
  const [type, setType] = useState<DeliveryType>(allowed[0]);
  const [line, setLine] = useState<DeliveryLine>('OFF_STUMP');
  const [length, setLength] = useState<DeliveryLength>('GOOD');
  const forced = type === 'YORKER' ? 'YORKER' : type === 'BOUNCER' ? 'SHORT' : null;
  return (
    <section className="flex flex-col gap-3">
      <Heading title={title} countdown={countdown} />
      <AggressionBar label={t('bowlc.yourAgg')} kind="bowling" level={level} onChange={(next) => next !== null && onLevel(next)} />
      <Choice label={t('pvp.m.delivery')}>
        {allowed.map((d) => (
          <Chip key={d} on={type === d} onClick={() => setType(d)}>
            {t(deliveryKey(d))}
          </Chip>
        ))}
      </Choice>
      <Choice label={t('bowlc.line')}>
        {LINES.map((l) => (
          <Chip key={l} on={line === l} onClick={() => setLine(l)}>
            {t(LINE_LABEL[l])}
          </Chip>
        ))}
      </Choice>
      <Choice label={t('bowlc.length')}>
        {LENGTHS.map((l) => (
          <Chip key={l} on={(forced ?? length) === l} disabled={forced !== null} onClick={() => setLength(l)}>
            {t(LENGTH_LABEL[l])}
          </Chip>
        ))}
      </Choice>
      <button type="button" disabled={waiting} onClick={() => onBowl(type, line, forced ?? length)} className="rounded-xl bg-brand-blue px-4 py-3 text-[15px] font-bold text-white disabled:opacity-45">
        {t('bowlc.bowl')}
      </button>
    </section>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function Chip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-60', on ? 'border-brand-blue bg-brand-blue text-white' : 'border-line bg-surface text-ink hover:bg-brand-blue-soft')}
    >
      {children}
    </button>
  );
}
