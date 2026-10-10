/**
 * IPL Manager home: the franchise hero banner, the season journey, the next
 * thing to do, and the cards a manager checks every week.
 */
import { CalendarDays, ChevronRight, Crown, Play, Target, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, HeroStatTile, ProgressBar, Stepper, type StepItem } from '@/components';
import {
  MANAGER,
  PHASE_ORDER,
  advanceBlocker,
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
import { currentLang, tr, type Key } from '@/i18n/core';
import { rich, useT } from '@/i18n/react';
import type { ManagerFixture } from '@/types/manager';
import { continueLabel, useContinue } from './PhaseFlow';
import { Button, FranchiseCrest, LinkButton, Money, ToneBadge, nameOf, phaseLabel, rankLabel, shortOf, useManager } from './ui';

/** A playoff stage as the screens write it: "qualifier 1", "final". */
export const stageWord = (stage: ManagerFixture['stage']) => tr(`mgr.stageLc.${stage}` as Key);

export default function ManagerHome() {
  const t = useT();
  const { state } = useManager();
  const f = state.franchises[state.franchiseId];
  const squad = squadOf(state, f.id);
  const pending = pendingUserFixture(state);
  const next = nextUserFixture(state);
  const blocker = advanceBlocker(state);
  const cont = useContinue();
  const table = rankStandings(state.season.standings);
  const position = table.findIndex((r) => r.franchiseId === f.id) + 1;
  const weak = squadWeaknesses(state, f.id).filter((w) => w.severity !== 'OK');
  const fc = forecast(state);
  const report = financeReport(state);
  const phaseIndex = PHASE_ORDER.indexOf(state.season.phase);
  const steps: StepItem[] = PHASE_ORDER.map((phase, i) => ({ id: phase, index: i + 1, label: phaseLabel(phase), status: i < phaseIndex ? 'done' : i === phaseIndex ? 'current' : 'locked' }));
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
          {t('mgr.home.motto1')}
          <br />
          <span className="ml-6">{t('mgr.home.motto2')}</span>
        </p>
        <div className="relative flex min-h-[280px] flex-col justify-between gap-5 p-5">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold/25 px-2 py-1 text-[11px] font-bold tracking-wide text-[#6b5200] uppercase">
              <Crown className="size-3.5" aria-hidden /> {t('mgr.ipl')} · {t('mgr.seasonN', { year: state.season.year })}
            </p>
            <h1 className="mt-2 text-[28px] leading-none font-bold text-brand-navy">{state.profile.name}</h1>
            <p className="mt-1.5 text-[14px] font-medium text-ink">
              {rankLabel(state.profile.rank)} <span className="mx-1.5 text-ink-soft">•</span> {f.name}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {phaseLabel(state.season.phase)}
              {state.season.phase === 'LEAGUE' ? ` · ${t('mgr.roundOf', { n: state.season.round, of: MANAGER.rules.leagueRounds })}` : ''}
              {position > 0 && state.season.phase !== 'SCOUTING' ? ` · ${t('mgr.home.inTable', { pos: ordinal(position) })}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <HeroStatTile label={t('mgr.reputation')} tint>
              <span className="text-[20px] font-bold text-ink">{Math.round(state.profile.reputation)}</span>
            </HeroStatTile>
            <HeroStatTile label={t('mgr.board')}>
              <span className="text-[16px] font-semibold text-ink">{Math.round(state.profile.boardConfidence)}%</span>
            </HeroStatTile>
            <HeroStatTile label={t('mgr.purse')}>
              <span className="text-[14px] font-semibold text-ink"><Money lakh={f.purse} /></span>
            </HeroStatTile>
            <HeroStatTile label={t('mgr.titles')}>
              <span className="text-[16px] font-semibold text-ink">{state.profile.trophies}</span>
            </HeroStatTile>
          </div>
        </div>
      </div>

      {/* Next action. */}
      <Card className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{t('mgr.home.nextUp')}</p>
          <p className="text-[15px] font-semibold text-ink">
            {state.profile.retired
              ? t('mgr.home.retired')
              : pending
                ? `${shortOf(state, pending.homeId)} v ${shortOf(state, pending.awayId)} · ${pending.stage === 'LEAGUE' ? t('mgr.roundN', { n: pending.round }) : phaseLabel('PLAYOFFS')}`
                : continueLabel(state)}
          </p>
          {blocker && !pending ? <p className="mt-0.5 text-[12.5px] text-brand-red" role="status">{blocker}</p> : null}
          {!state.profile.retired && state.season.phase === 'SCOUTING' && holds(state, 'SCOUTING') && state.staff.every((s) => s.kind !== 'SCOUT' || !s.assignment) ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {rich(t('mgr.home.scoutsIdle'), {
                link: (
                  <Link to="/manager/scouting" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
                    {t('mgr.home.sendThemOut')}
                  </Link>
                ),
              })}
            </p>
          ) : null}
          {!state.profile.retired && !state.profile.unemployed && !state.profile.fullControl ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {t('mgr.home.staffJobs')}{' '}
              <Link to="/manager/profile" className="font-semibold text-brand-blue underline-offset-2 hover:underline">{t('mgr.takeFullControl')}</Link>
            </p>
          ) : null}
        </div>
        {pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION')) ? (
          <LinkButton to={`/manager/match/${pending.id}`} variant="primary">
            <Play className="size-4 fill-white" aria-hidden /> {t('mgr.goToMatch')}
          </LinkButton>
        ) : (
          <Button variant="gold" disabled={cont.disabled} onClick={cont.go}>
            {cont.label} <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader title={t('mgr.home.journey')} subtitle={t('mgr.home.journeySub')} className="mb-3" />
        <Stepper steps={steps} endLabel={t('mgr.home.nextSeason')} />
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title={t('mgr.home.nextMatch')} action={{ label: t('mgr.nav.fixtures'), to: '/manager/fixtures' }} className="mb-3" />
          {next ? (
            <div className="flex items-center justify-between gap-2">
              <TeamMini state={state} id={next.homeId} />
              <div className="text-center">
                <p className="text-[12px] font-semibold text-ink-muted">{t('mgr.vs')}</p>
                <p className="text-[11px] text-ink-muted">{next.stage === 'LEAGUE' ? t('mgr.roundN', { n: next.round }) : stageWord(next.stage)}</p>
              </div>
              <TeamMini state={state} id={next.awayId} />
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">{state.season.fixtures.length ? t('mgr.home.noMoreMatches') : t('mgr.home.fixturesLater')}</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t('mgr.boardObjectives')} action={{ label: t('mgr.nav.career'), to: '/manager/profile' }} className="mb-2" />
          <ul className="flex flex-col gap-1.5">
            {state.season.objectives.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-[12.5px] text-ink">
                <Target className={cn('mt-0.5 size-3.5 shrink-0', o.met === true ? 'text-brand-green' : o.met === false ? 'text-brand-red' : 'text-brand-blue')} aria-hidden />
                <span>
                  {o.label}
                  {o.met !== null ? <span className="ml-1 font-semibold">{o.met ? t('mgr.objMet') : t('mgr.objMissed')}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t('mgr.nav.squad')} action={{ label: t('common.view'), to: '/manager/squad' }} className="mb-2" />
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <Users className="size-4 text-brand-blue" aria-hidden />
            {t('mgr.home.squadLine', { n: squad.length, os: squad.filter((p) => p.overseas).length, inj: squad.filter((p) => p.injuredWeeks > 0).length })}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {weak.length === 0 ? <ToneBadge tone="green">{t('mgr.balancedSquad')}</ToneBadge> : weak.map((w) => <ToneBadge key={w.area} tone={w.severity === 'WEAK' ? 'red' : 'orange'}>{t('mgr.weakness', { area: `@mgr.area.${w.area}`, sev: `@mgr.sev.${w.severity}` })}</ToneBadge>)}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t('mgr.nav.finances')} action={{ label: t('mgr.home.report'), to: '/manager/finances' }} className="mb-2" />
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <Wallet className="size-4 text-brand-blue" aria-hidden /> {t('mgr.balance')} <Money lakh={state.finances.balance} className="font-semibold" />
          </p>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {t('mgr.home.seasonSoFar')} <Money lakh={report.profit} /> · {t('mgr.home.forecast')} <Money lakh={fc.profit} className={fc.profit < 0 ? 'text-brand-red' : 'text-brand-green'} />
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('mgr.pointsTable')} action={{ label: t('mgr.home.fullTable'), to: '/manager/table' }} className="mb-2" />
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
              <CalendarDays className="size-4" aria-hidden /> {t('mgr.home.tableLater')}
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title={t('mgr.home.inbox')} action={{ label: t('mgr.viewAll'), to: '/manager/news' }} className="mb-2" />
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
          <CardHeader title={t('mgr.home.seasonAwards')} action={{ label: t('mgr.nav.awards'), to: '/manager/awards' }} className="mb-2" />
          <p className="text-[13px] text-ink">
            {t('mgr.champions')}: <strong>{shortOf(state, state.season.awards.champions)}</strong> · {t('mgr.orangeCap')}: {nameOf(state, state.season.awards.orangeCap?.playerId)} · {t('mgr.purpleCap')}: {nameOf(state, state.season.awards.purpleCap?.playerId)}
          </p>
        </Card>
      ) : null}
      <ProgressBar value={state.profile.boardConfidence} tone={state.profile.boardConfidence < MANAGER.board.warnBelow ? 'red' : 'green'} label={t('mgr.boardConfidence')} className="sr-only" />
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
  if (currentLang() === 'ta') return tr('mgr.ordinal', { n });
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
