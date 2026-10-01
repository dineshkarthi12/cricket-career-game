/**
 * IPL Manager home: the franchise hero banner, the season journey, the next
 * thing to do, and the cards a manager checks every week.
 */
import { CalendarDays, ChevronRight, Crown, Play, Target, Users, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, HeroStatTile, ProgressBar, Stepper, type StepItem } from '@/components';
import {
  MANAGER,
  PHASE_LABEL,
  PHASE_ORDER,
  advance,
  advanceBlocker,
  advanceLabel,
  financeReport,
  forecast,
  nextUserFixture,
  pendingUserFixture,
  rankStandings,
  netRunRate,
  squadOf,
  squadWeaknesses,
  holds,
} from '@/engine/manager';
import { cn } from '@/lib/cn';
import { Button, FranchiseCrest, LinkButton, Money, ToneBadge, nameOf, shortOf, useManager } from './ui';

export default function ManagerHome() {
  const { state, apply } = useManager();
  const navigate = useNavigate();
  const f = state.franchises[state.franchiseId];
  const squad = squadOf(state, f.id);
  const pending = pendingUserFixture(state);
  const next = nextUserFixture(state);
  const blocker = advanceBlocker(state);
  const table = rankStandings(state.season.standings);
  const position = table.findIndex((r) => r.franchiseId === f.id) + 1;
  const weak = squadWeaknesses(state, f.id).filter((w) => w.severity !== 'OK');
  const fc = forecast(state);
  const report = financeReport(state);
  const phaseIndex = PHASE_ORDER.indexOf(state.season.phase);
  const steps: StepItem[] = PHASE_ORDER.map((phase, i) => ({ id: phase, index: i + 1, label: PHASE_LABEL[phase], status: i < phaseIndex ? 'done' : i === phaseIndex ? 'current' : 'locked' }));
  const latest = state.news.slice(0, 4);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Hero banner, in the dashboard's style. */}
      <div className="relative overflow-hidden rounded-card shadow-card">
        <img src="/assets/hero-bg.jpg" alt="" aria-hidden className="absolute inset-0 size-full object-cover object-[50%_26%]" />
        <div className="hero-wash absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute top-6 right-6 hidden opacity-90 md:block" aria-hidden>
          <FranchiseCrest franchise={f} size={150} />
        </div>
        <p className="font-hand pointer-events-none absolute right-[22%] bottom-6 hidden -rotate-3 text-[26px] leading-tight text-brand-navy/90 xl:block" aria-hidden>
          Build the team.
          <br />
          <span className="ml-6">Win the trophy.</span>
        </p>
        <div className="relative flex min-h-[280px] flex-col justify-between gap-5 p-5">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold/25 px-2 py-1 text-[11px] font-bold tracking-wide text-[#6b5200] uppercase">
              <Crown className="size-3.5" aria-hidden /> IPL Manager · Season {state.season.year}
            </p>
            <h1 className="mt-2 text-[28px] leading-none font-bold text-brand-navy">{state.profile.name}</h1>
            <p className="mt-1.5 text-[14px] font-medium text-ink">
              {MANAGER.ranks.label[state.profile.rank]} <span className="mx-1.5 text-ink-soft">•</span> {f.name}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {PHASE_LABEL[state.season.phase]}
              {state.season.phase === 'LEAGUE' ? ` · Round ${state.season.round} of ${MANAGER.rules.leagueRounds}` : ''}
              {position > 0 && state.season.phase !== 'SCOUTING' ? ` · ${ordinal(position)} in the table` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <HeroStatTile label="Reputation" tint>
              <span className="text-[20px] font-bold text-ink">{Math.round(state.profile.reputation)}</span>
            </HeroStatTile>
            <HeroStatTile label="Board">
              <span className="text-[16px] font-semibold text-ink">{Math.round(state.profile.boardConfidence)}%</span>
            </HeroStatTile>
            <HeroStatTile label="Purse">
              <span className="text-[14px] font-semibold text-ink"><Money lakh={f.purse} /></span>
            </HeroStatTile>
            <HeroStatTile label="Titles">
              <span className="text-[16px] font-semibold text-ink">{state.profile.trophies}</span>
            </HeroStatTile>
          </div>
        </div>
      </div>

      {/* Next action. */}
      <Card className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">Next up</p>
          <p className="text-[15px] font-semibold text-ink">
            {state.profile.retired
              ? 'Your career is over - your legacy is written.'
              : pending
                ? `${shortOf(state, pending.homeId)} v ${shortOf(state, pending.awayId)} · ${pending.stage === 'LEAGUE' ? `Round ${pending.round}` : PHASE_LABEL.PLAYOFFS}`
                : advanceLabel(state)}
          </p>
          {blocker && !pending ? <p className="mt-0.5 text-[12.5px] text-brand-red" role="status">{blocker}</p> : null}
        </div>
        {pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION')) ? (
          <LinkButton to={`/manager/match/${pending.id}`} variant="primary">
            <Play className="size-4 fill-white" aria-hidden /> Go to match
          </LinkButton>
        ) : (
          <Button
            variant="gold"
            disabled={Boolean(blocker) || state.profile.retired}
            onClick={() => {
              if (state.season.phase === 'AUCTION_PREP' && holds(state, 'AUCTION')) {
                if (apply(advance(state))) navigate('/manager/auction');
                return;
              }
              apply(advance(state));
            }}
          >
            {advanceLabel(state)} <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader title="Season journey" subtitle="Every season runs from the scouting trail to the final" className="mb-3" />
        <Stepper steps={steps} endLabel="Next season" />
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Next match" action={{ label: 'Fixtures', to: '/manager/fixtures' }} className="mb-3" />
          {next ? (
            <div className="flex items-center justify-between gap-2">
              <TeamMini state={state} id={next.homeId} />
              <div className="text-center">
                <p className="text-[12px] font-semibold text-ink-muted">vs</p>
                <p className="text-[11px] text-ink-muted">{next.stage === 'LEAGUE' ? `Round ${next.round}` : next.stage.replace('_', ' ').toLowerCase()}</p>
              </div>
              <TeamMini state={state} id={next.awayId} />
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">{state.season.fixtures.length ? 'No more matches this season.' : 'Fixtures are published in pre-season.'}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Board objectives" action={{ label: 'Career', to: '/manager/profile' }} className="mb-2" />
          <ul className="flex flex-col gap-1.5">
            {state.season.objectives.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-[12.5px] text-ink">
                <Target className={cn('mt-0.5 size-3.5 shrink-0', o.met === true ? 'text-brand-green' : o.met === false ? 'text-brand-red' : 'text-brand-blue')} aria-hidden />
                <span>
                  {o.label}
                  {o.met !== null ? <span className="ml-1 font-semibold">{o.met ? '(met)' : '(missed)'}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Squad" action={{ label: 'View', to: '/manager/squad' }} className="mb-2" />
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <Users className="size-4 text-brand-blue" aria-hidden />
            {squad.length} players · {squad.filter((p) => p.overseas).length} overseas · {squad.filter((p) => p.injuredWeeks > 0).length} injured
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {weak.length === 0 ? <ToneBadge tone="green">Balanced squad</ToneBadge> : weak.map((w) => <ToneBadge key={w.area} tone={w.severity === 'WEAK' ? 'red' : 'orange'}>{w.area.replace('_', ' ').toLowerCase()}: {w.severity.toLowerCase()}</ToneBadge>)}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Finances" action={{ label: 'Report', to: '/manager/finances' }} className="mb-2" />
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <Wallet className="size-4 text-brand-blue" aria-hidden /> Balance <Money lakh={state.finances.balance} className="font-semibold" />
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Season so far <Money lakh={report.profit} /> · forecast <Money lakh={fc.profit} className={fc.profit < 0 ? 'text-brand-red' : 'text-brand-green'} />
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Points table" action={{ label: 'Full table', to: '/manager/table' }} className="mb-2" />
          {table.length ? (
            <ol className="flex flex-col">
              {table.slice(0, 5).map((r, i) => (
                <li key={r.franchiseId} className={cn('flex items-center gap-2 border-b border-line/70 py-1.5 text-[12.5px] last:border-0', r.franchiseId === f.id && 'font-semibold text-brand-blue')}>
                  <span className="w-5 text-ink-muted">{i + 1}</span>
                  <span className="flex-1">{shortOf(state, r.franchiseId)}</span>
                  <span className="w-10 text-right tabular-nums">{r.played}</span>
                  <span className="w-12 text-right tabular-nums">{netRunRate(r).toFixed(2)}</span>
                  <span className="w-8 text-right font-semibold tabular-nums">{r.points}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <CalendarDays className="size-4" aria-hidden /> The table starts with the league.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Inbox / news" action={{ label: 'View all', to: '/manager/news' }} className="mb-2" />
          <ul className="flex flex-col gap-2">
            {latest.map((n) => (
              <li key={n.id}>
                <Link to={n.route ?? '/manager/news'} className="block rounded-lg px-1 py-1 hover:bg-page">
                  <p className={cn('text-[13px] text-ink', !n.read && 'font-semibold')}>{n.title}</p>
                  <p className="line-clamp-1 text-[12px] text-ink-muted">{n.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {state.season.awards ? (
        <Card>
          <CardHeader title="Season awards" action={{ label: 'Awards', to: '/manager/awards' }} className="mb-2" />
          <p className="text-[13px] text-ink">
            Champions: <strong>{shortOf(state, state.season.awards.champions)}</strong> · Orange Cap: {nameOf(state, state.season.awards.orangeCap?.playerId)} · Purple Cap: {nameOf(state, state.season.awards.purpleCap?.playerId)}
          </p>
        </Card>
      ) : null}
      <ProgressBar value={state.profile.boardConfidence} tone={state.profile.boardConfidence < MANAGER.board.warnBelow ? 'red' : 'green'} label="Board confidence" className="sr-only" />
    </div>
  );
}

function TeamMini({ state, id }: { state: ReturnType<typeof useManager>['state']; id: string }) {
  const f = state.franchises[id];
  return (
    <div className="flex flex-col items-center gap-1">
      <FranchiseCrest franchise={f} size={40} />
      <p className={cn('text-[12.5px] font-semibold', id === state.franchiseId ? 'text-brand-blue' : 'text-ink')}>{f.short}</p>
    </div>
  );
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
