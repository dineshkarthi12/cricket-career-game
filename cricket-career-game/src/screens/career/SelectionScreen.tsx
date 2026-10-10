import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '@/i18n/react';
import { isKey, tr, type Key } from '@/i18n/core';
import { Badge, Card, CardHeader, Tabs, TutorialTip } from '@/components';
import { ROLE_GROUP_LABEL, IN_SQUAD, competitionForPlaces, roleGroup, weightedForm } from '@/engine/career/squads';
import { CLUB_COMPETITION, stageCompetitions } from '@/engine/career/involvement';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { proPlaces } from '@/lib/pro';
import type { GameState, InboxMessage, SquadPlace, SquadStatus } from '@/types';

const TABS = ['squads', 'announcements', 'news', 'trials'] as const;

/** A role group as the engine names it ("seamer"), in the app's language. */
export function groupName(t: (key: Key) => string, group: string): string {
  return isKey(`group.${group}`) ? t(`group.${group}` as Key) : group;
}

export function statusTone(status: SquadStatus) {
  if (IN_SQUAD.includes(status)) return 'green' as const;
  if (status === 'PROBABLES' || status === 'RESERVE' || status === 'TRIAL_ONLY') return 'orange' as const;
  return 'red' as const;
}

export default function SelectionScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <Selection state={state} />;
}

function Selection({ state }: { state: GameState }) {
  const t = useT();
  const [tab, setTab] = useState('squads');
  const places = [...stageCompetitions(state.career.currentStageId).map((id) => state.career.squads[id]), ...(state.pro ? proPlaces(state) : [])]
    .filter((p): p is SquadPlace => Boolean(p) && Boolean(p!.teamId));
  const club = state.career.squads[CLUB_COMPETITION];
  const announcements = state.inbox.filter((m) => m.category === 'SELECTION');
  const news = state.inbox.filter((m) => m.category === 'NEWS' || m.category === 'AWARD' || m.sender === 'MEDIA');

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('nav.selection')}</h1>
        <p className="text-[13px] text-ink-muted">{t('car.sel.intro')}</p>
      </div>
      <TutorialTip id="selection" />
      <Tabs tabs={TABS.map((id) => ({ id, label: t(`car.sel.tab.${id}`) }))} value={tab} onChange={setTab} label={t('car.sel.sections')} />

      {tab === 'squads' ? (
        <>
          {places.length === 0 ? <Card><p className="text-[13px] text-ink-muted">{t('car.sel.noSquads')}</p></Card> : null}
          {places.map((place) => (
            <SquadCard key={place.tournamentId} state={state} place={place} />
          ))}
          {club ? (
            <Card>
              <CardHeader title={t('car.sel.club')} subtitle={club.reason} />
            </Card>
          ) : null}
        </>
      ) : null}
      {tab === 'announcements' ? <MessageList messages={announcements} empty={t('car.sel.noAnnouncements')} today={state.season.currentDate} /> : null}
      {tab === 'news' ? <MessageList messages={news} empty={t('car.sel.noNews')} today={state.season.currentDate} /> : null}
      {tab === 'trials' ? <TrialList state={state} /> : null}
    </div>
  );
}

function SquadCard({ state, place }: { state: GameState; place: SquadPlace }) {
  const t = useT();
  const team = place.teamId ? state.teams[place.teamId] : undefined;
  const ranked = useMemo(() => (team ? competitionForPlaces(state, team.id, [place.tournamentId]) : []), [state, team, place.tournamentId]);
  const name = TOURNAMENTS_BY_ID[place.tournamentId]?.name ?? place.tournamentId;
  const group = groupName(t, ROLE_GROUP_LABEL[roleGroup(state.player.role)]);
  return (
    <Card>
      <CardHeader
        title={name}
        subtitle={team ? t('car.sel.since', { team: team.name, date: formatLongDate(place.since) }) : undefined}
        action={{ label: t('car.sel.table'), to: `/tournaments/${place.tournamentId}` }}
        className="mb-2"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(place.status)}>{t(`status.${place.status}`)}</Badge>
        <p className="text-[13px] text-ink">{place.reason}</p>
      </div>
      {ranked.length ? (
        <>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">{t('car.sel.competition', { group })}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-[12px] text-ink-muted">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">{t('m.player')}</th>
                  <th className="py-1.5 pr-2 font-medium">{t('car.col.age')}</th>
                  <th className="py-1.5 pr-2 font-medium">OVR</th>
                  <th className="py-1.5 pr-2 font-medium">{t('hero.form')}</th>
                  <th className="py-1.5 pr-2 font-medium">{t('path.col.season')}</th>
                  <th className="py-1.5 pr-2 font-medium">{t('car.col.selectors')}</th>
                  <th className="py-1.5 font-medium">{t('car.sel.place')}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => {
                  const c = r.candidate;
                  const bowler = c.group === 'PACE' || c.group === 'SPIN';
                  return (
                    <tr key={c.id} className={cn('border-t border-line', c.isUser && 'bg-brand-blue-soft font-semibold')}>
                      <td className="py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                      <td className="py-1.5 pr-2 text-ink">
                        {c.isUser ? t('car.you') : c.name}
                        {c.outside ? <span className="ml-1 text-[11px] font-normal text-ink-muted">{t('car.sel.probable')}</span> : null}
                        {c.injured && !c.isUser ? <span className="ml-1 text-[11px] font-normal text-brand-red">{t('car.sel.injured')}</span> : null}
                      </td>
                      <td className="py-1.5 pr-2 text-ink">{c.age}</td>
                      <td className="py-1.5 pr-2 text-ink">{c.overall}</td>
                      <td className="py-1.5 pr-2 text-ink">{weightedForm(c.ratings)}</td>
                      <td className="py-1.5 pr-2 text-ink-muted">
                        {c.season.matches
                          ? t(bowler ? 'car.sel.wktsIn' : 'car.sel.runsIn', { n: Math.round(bowler ? c.season.wickets : c.season.runs), m: c.season.matches })
                          : '-'}
                      </td>
                      <td className="py-1.5 pr-2 text-ink">{r.score.toFixed(1)}</td>
                      <td className="py-1.5">
                        {r.holdsSpot ? <Badge tone="green">XI</Badge> : r.inSquad ? <Badge tone="blue">{t('step.SQUAD')}</Badge> : <Badge tone="grey">{t('car.sel.outside')}</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-ink-muted">{t('car.sel.weigh')}</p>
        </>
      ) : null}
    </Card>
  );
}

function MessageList({ messages, empty, today }: { messages: InboxMessage[]; empty: string; today: string }) {
  const t = useT();
  if (messages.length === 0) return <Card><p className="text-[13px] text-ink-muted">{empty}</p></Card>;
  return (
    <Card>
      <ul className="flex flex-col divide-y divide-line">
        {messages.slice(0, 40).map((m) => (
          <li key={m.id} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">{m.subject}</span>
              <span className="text-[12px] text-ink-muted">
                {m.senderName} · {m.date === today ? t('next.when.today') : formatLongDate(m.date)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-muted">{m.body}</p>
            {m.actions.filter((a) => a.kind === 'NAVIGATE' && a.route).map((a) => (
              <Link key={a.id} to={a.route!} className="mt-1 inline-block text-[13px] font-semibold text-brand-blue">
                {a.label}
              </Link>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TrialList({ state }: { state: GameState }) {
  const tx = useT();
  if (state.career.trials.length === 0) return <Card><p className="text-[13px] text-ink-muted">{tx('car.sel.noTrials')}</p></Card>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {state.career.trials.map((t) => (
        <Card key={t.fixtureId}>
          <CardHeader title={t.title} subtitle={`${formatLongDate(t.date)} · ${tx(t.purpose === 'SQUAD' ? 'car.sel.squadTrial' : 'car.sel.nextTrial')}`} className="mb-2" />
          <p className="text-[13px] text-ink">
            {tx('car.sel.trialLine', {
              nets: t.nets.score,
              fitness: tx(t.fitness.passed ? 'car.sel.passed' : 'car.sel.failed'),
              rating: t.practice.rating.toFixed(1),
              bonus: `${t.bonus > 0 ? '+' : ''}${t.bonus}`,
            })}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">{t.verdict}</p>
          {t.decisions.map((d) => (
            <div key={d.tournamentId} className="mt-2 flex items-center gap-2 text-[12.5px]">
              <Badge tone={statusTone(d.status)}>{tx(`status.${d.status}`)}</Badge>
              <span className="text-ink">{TOURNAMENTS_BY_ID[d.tournamentId]?.shortName ?? d.tournamentId}</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
