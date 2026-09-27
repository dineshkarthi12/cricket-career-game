/**
 * The road into a side, step by step, the way a console career mode shows it:
 * the scouts watch you, the selectors shortlist you, you get a trial or a
 * camp, the squad is named, you get a game, and you hold your place. Built
 * from what the career already records (squad places, trials, matches, the
 * competition for places), so it is always the truth about where you stand.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { IN_SQUAD, STATUS_LABEL, competitionForPlaces, roleGroup, ROLE_GROUP_LABEL, userSeasonStats, weightedForm } from './squads';
import { stageCompetitions } from './involvement';
import { tournamentOf } from '../tournament/live';
import type { Fixture, GameState, SquadStatus } from '@/types';

export type JourneyStepId = 'SCOUTED' | 'SHORTLISTED' | 'TRIAL' | 'SQUAD' | 'XI' | 'ESTABLISHED';
export type JourneyStepStatus = 'done' | 'current' | 'locked' | 'failed';

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  status: JourneyStepStatus;
  /** One line on this step: what happened, or what it takes. */
  detail: string;
}

export interface CompetitionJourney {
  tournamentId: string;
  name: string;
  shortName: string;
  teamName: string | null;
  status: SquadStatus | null;
  steps: JourneyStep[];
  /** The step in play now (the first not done). */
  current: JourneyStep;
  /** Where the selectors rank the player among their role group. */
  rank: { position: number; of: number; xi: number; squad: number; group: string } | null;
  /** What the scouts have been writing. */
  scoutReport: string;
  /** The next selection event: a meeting, a trial, a camp. */
  nextEvent: { date: string; title: string } | null;
  /** The side's next match in the competition, and whether it is the player's. */
  nextMatch: { date: string; title: string; withYou: boolean } | null;
  /** The one-line headline for the card. */
  headline: string;
}

export const JOURNEY_LABELS: Record<JourneyStepId, string> = {
  SCOUTED: 'Scouted',
  SHORTLISTED: 'Shortlisted',
  TRIAL: 'Trial',
  SQUAD: 'Squad',
  XI: 'Playing XI',
  ESTABLISHED: 'Regular',
};

const SELECTION_EVENTS: Fixture['kind'][] = ['SELECTION_MEETING', 'TRIAL', 'SELECTION_CAMP', 'FITNESS_ASSESSMENT'];

/** Matches in a regular's run before they count as established. */
const ESTABLISHED_MATCHES = 3;

/** The competitions worth a journey now: this stage's, where a tournament is running. */
export function journeyCompetitions(state: GameState, extra: string[] = []): string[] {
  const ids = [...stageCompetitions(state.career.currentStageId), ...extra];
  return [...new Set(ids)].filter((id) => tournamentOf(state, id) || state.career.squads[id]);
}

function formLabel(form: number): string {
  if (form >= 8) return 'outstanding';
  if (form >= 7) return 'strong';
  if (form >= 6) return 'decent';
  if (form >= 5) return 'patchy';
  return 'poor';
}

/** The scouts' line: form, figures at the level they watched, and trust. */
function scoutReport(state: GameState): string {
  const player = state.player;
  const all = userSeasonStats(state, null);
  const bowler = player.role === 'PACE_BOWLER' || player.role === 'SPIN_BOWLER';
  const allRounder = player.role === 'BATTING_ALLROUNDER' || player.role === 'BOWLING_ALLROUNDER';
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const batting = `${all.runs} runs${all.average !== null ? ` at ${all.average.toFixed(1)}` : ''}${all.fifties + all.hundreds ? ` (${all.hundreds ? `${plural(all.hundreds, 'hundred')}, ` : ''}${plural(all.fifties, 'fifty', 'fifties')})` : ''}`;
  const bowling = `${plural(all.wickets, 'wicket')}${all.bowlingAverage !== null ? ` at ${all.bowlingAverage.toFixed(1)}` : ''}${all.economy !== null ? `, economy ${all.economy.toFixed(2)}` : ''}`;
  // Batters are judged on runs, bowlers on wickets and economy, all-rounders on both.
  const line = bowler ? bowling : allRounder ? `${batting}; ${bowling}` : batting;
  const figures = all.matches ? `${line} in ${plural(all.matches, 'match', 'matches')}` : 'no matches yet this season';
  const form = weightedForm(player.condition.recentRatings ?? []);
  const trust = Math.round(player.condition.selectorTrust);
  return `Scout report: ${figures}; form ${formLabel(form)} (${form.toFixed(1)}); selectors' trust ${trust}/100; OVR ${player.overall}.`;
}

function nextSelectionEvent(state: GameState): { date: string; title: string } | null {
  const today = state.season.currentDate;
  const next = Object.values(state.fixtures)
    .filter((f) => !f.played && f.date > today && SELECTION_EVENTS.includes(f.kind) && (f.involvesUser || f.kind === 'SELECTION_MEETING'))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { date: next.date, title: next.title } : null;
}

function nextMatchIn(state: GameState, tournamentId: string, teamId: string | null): CompetitionJourney['nextMatch'] {
  const today = state.season.currentDate;
  const next = Object.values(state.fixtures)
    .filter(
      (f) =>
        f.kind === 'MATCH' &&
        !f.played &&
        f.date >= today &&
        f.tournamentId === tournamentId &&
        (f.involvesUser || (teamId !== null && (f.homeTeamId === teamId || f.awayTeamId === teamId))),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next ? { date: next.date, title: next.title, withYou: next.involvesUser } : null;
}

/** The journey into one competition's side. */
export function competitionJourney(state: GameState, tournamentId: string): CompetitionJourney {
  const meta = TOURNAMENTS_BY_ID[tournamentId];
  const place = state.career.squads[tournamentId] ?? null;
  const t = tournamentOf(state, tournamentId);
  const teamId = place?.teamId || t?.userTeamId || null;
  const team = teamId ? state.teams[teamId] : undefined;
  const status = place?.status ?? null;
  const season = userSeasonStats(state, [tournamentId]);
  const everything = userSeasonStats(state, null);

  const ranked = team ? competitionForPlaces(state, team.id, [tournamentId]) : [];
  const at = ranked.findIndex((r) => r.candidate.isUser);
  const group = roleGroup(state.player.role);
  const rank =
    at >= 0
      ? {
          position: at + 1,
          of: ranked.length,
          xi: ranked.filter((r) => r.holdsSpot).length,
          squad: ranked.filter((r) => r.inSquad).length,
          group: ROLE_GROUP_LABEL[group],
        }
      : null;

  const trial = state.career.trials.find(
    (r) => r.seasonYear === state.season.year && r.decisions.some((d) => d.tournamentId === tournamentId),
  );
  const inSquad = status ? IN_SQUAD.includes(status) : false;
  const onTheList = status !== null && status !== 'NOT_SELECTED';
  const dropped = status === 'DROPPED';

  const scouted = everything.matches > 0 || onTheList || state.player.condition.selectorTrust >= 40;
  const shortlisted = onTheList || (rank !== null && rank.position <= rank.squad + 2);
  const trialed = Boolean(trial) || inSquad || status === 'RESERVE' || status === 'STANDBY';
  const named = inSquad || dropped;
  const played = season.matches > 0;
  const established = inSquad && season.matches >= ESTABLISHED_MATCHES;

  const rankLine = rank
    ? `Ranked ${rank.position} of ${rank.of} ${rank.group}s - the XI takes ${rank.xi}, the squad ${rank.squad}.`
    : '';

  const steps: JourneyStep[] = [
    {
      id: 'SCOUTED',
      label: JOURNEY_LABELS.SCOUTED,
      status: scouted ? 'done' : 'current',
      detail: scouted ? 'The scouts have your name and your numbers.' : 'Play matches and score runs or take wickets - scouts watch every level.',
    },
    {
      id: 'SHORTLISTED',
      label: JOURNEY_LABELS.SHORTLISTED,
      status: shortlisted ? 'done' : 'locked',
      detail: shortlisted
        ? `On the selectors' list${status ? ` (${STATUS_LABEL[status].toLowerCase()})` : ''}.`
        : `Not on the list yet. ${rankLine || 'Form and figures get you noticed.'}`,
    },
    {
      id: 'TRIAL',
      label: JOURNEY_LABELS.TRIAL,
      status: trialed ? 'done' : 'locked',
      detail: trial
        ? `${trial.title}: nets ${trial.nets.score}/10, fitness ${trial.fitness.passed ? 'passed' : 'failed'}, practice rating ${trial.practice.rating.toFixed(1)}.`
        : trialed
          ? 'Picked on performances - no trial needed.'
          : 'A trial or camp decides the squad places. Attend it yourself to show them.',
    },
    {
      id: 'SQUAD',
      label: dropped ? 'Dropped' : JOURNEY_LABELS.SQUAD,
      status: dropped ? 'failed' : named ? 'done' : 'locked',
      detail: dropped
        ? `Dropped. ${place?.reason ?? ''} Runs and wickets elsewhere bring you back.`
        : named
          ? `Named in the ${team?.name ?? ''} squad. ${place?.reason ?? ''}`.trim()
          : status === 'RESERVE' || status === 'STANDBY'
            ? `${STATUS_LABEL[status]}: one injury or one bad run from the squad.`
            : 'Squad not named yet for you.',
    },
    {
      id: 'XI',
      label: JOURNEY_LABELS.XI,
      status: played ? 'done' : 'locked',
      detail: played
        ? `${season.matches} match${season.matches === 1 ? '' : 'es'}: ${season.runs} runs, ${season.wickets} wickets.`
        : inSquad
          ? 'In the squad - the XI is picked match by match on form.'
          : 'Get in the squad first.',
    },
    {
      id: 'ESTABLISHED',
      label: JOURNEY_LABELS.ESTABLISHED,
      status: established ? 'done' : 'locked',
      detail: established ? 'A regular. Keep performing to stay there.' : `Hold your place for ${ESTABLISHED_MATCHES} matches.`,
    },
  ];
  // The first step not done is the one in play; a drop is the step to win back.
  const currentIndex = steps.findIndex((s) => s.status !== 'done');
  if (currentIndex >= 0 && steps[currentIndex].status === 'locked') steps[currentIndex] = { ...steps[currentIndex], status: 'current' };
  const current = currentIndex >= 0 ? steps[currentIndex] : steps[steps.length - 1];

  const name = meta?.name ?? tournamentId;
  const headline = dropped
    ? `Dropped from the ${name} side - time for a comeback.`
    : established
      ? `A regular in the ${name} side.`
      : played
        ? `In the ${name} XI - hold your place.`
        : inSquad
          ? `In the ${name} squad - waiting for a game.`
          : shortlisted
            ? `On the ${name} shortlist - the next step is the squad.`
            : scouted
              ? `Scouts are watching - not on the ${name} list yet.`
              : `Get noticed: play, and perform.`;

  return {
    tournamentId,
    name,
    shortName: meta?.shortName ?? tournamentId,
    teamName: team?.name ?? null,
    status,
    steps,
    current,
    rank,
    scoutReport: scoutReport(state),
    nextEvent: nextSelectionEvent(state),
    nextMatch: nextMatchIn(state, tournamentId, teamId),
    headline,
  };
}

/** Journeys for every competition worth one right now. */
export function selectionJourney(state: GameState, extra: string[] = []): CompetitionJourney[] {
  return journeyCompetitions(state, extra).map((id) => competitionJourney(state, id));
}
