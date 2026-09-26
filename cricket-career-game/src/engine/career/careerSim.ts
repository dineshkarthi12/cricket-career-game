/**
 * Whole careers, played headless: a player created at 10 goes through the
 * real calendar with the default training plan, every one of their matches
 * on the fast sim, every trial with the coach's default choices, every
 * selection meeting and season review. The harness the selection and
 * progression constants were tuned against (see PROGRESS.md).
 */
import { createRng } from '../match/rng';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { createNewCareer } from '../newCareer';
import { advanceWeek } from '../calendar/advance';
import { autoTrial } from './trials';
import { autoPlayFixture } from './autoplay';
import { IN_SQUAD } from './squads';
import { answerLeadership } from '../pro/leadership';
import { answerTrade } from '../pro/ipl';
import { autoRetire } from '../pro/retirement';
import { legacyRating } from '../pro/legacy';
import { NATIONAL } from '../config';
import { ageInYears } from '../development';
import type { CreationRole } from '../development';
import type { CareerStageId, GameState, SeasonOutcome } from '@/types';

export interface SimulatedCareerRun {
  seed: number;
  role: CreationRole;
  hiddenPotential: number;
  /** Age each stage was first reached, if it was (1-10: selected and playing there; 11-20: entered). */
  reachedAt: Partial<Record<CareerStageId, number>>;
  /** Senior formats established in (stages 8-10), with the age. */
  establishedAt: Partial<Record<CareerStageId, number>>;
  /** Age each stage was entered (became current), if it was. */
  enteredAt: Partial<Record<CareerStageId, number>>;
  /** Age each stage was completed. */
  completedAt: Partial<Record<CareerStageId, number>>;
  outcomes: SeasonOutcome[];
  drops: number;
  comebacks: number;
  finalStageId: CareerStageId;
  finalOverall: number;
  peakOverall: number;
  seasons: number;
  matches: number;
  /** Age the career ended (retired from all cricket), or null if it ran out of time. */
  retiredAt: number | null;
  caps: { T20I: number; ODI: number; TEST: number };
  iplSeasons: number;
  iplMatches: number;
  /** Levels captained. */
  captain: { state: boolean; ipl: boolean; india: boolean };
  legacyTier: string;
  legacyScore: number;
  awards: number;
  /** The save's size at the end, bytes of JSON. */
  saveBytes: number;
  maxSaveBytes: number;
}

const ROLES: CreationRole[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];

/** Play one week, attending trials and matches as the clock stops for them. */
export function playOn(state: GameState): GameState {
  const result = advanceWeek(state);
  let next = result.state;
  if (result.trial) next = autoTrial(next, result.trial.id);
  else if (result.stoppedFor) next = autoPlayFixture(next, result.stoppedFor);
  return autoDecisions(next);
}

/**
 * The calls a real player makes, made for them: most accept a leadership
 * offer, a benched player takes the trade, and retirement comes when the
 * selectors have moved on.
 */
export function autoDecisions(state: GameState): GameState {
  let next = state;
  if (!next.pro) return next;
  const offer = next.pro.leadership.offer;
  if (offer) next = answerLeadership(next, createRng(saltOf(offer.id) ^ next.seed).chance(0.85));
  if (next.pro.ipl.tradeOffer) next = answerTrade(next, true);
  return next;
}

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * One whole career. With no `endAge` it runs until the player retires from
 * all cricket (or the hard stop in RETIREMENT); the sim retires them the way
 * players do (`autoRetire`).
 */
export function simulateCareer(seed: number, endAge?: number): SimulatedCareerRun {
  const rng = createRng(seed);
  const role = rng.pick(ROLES);
  const month = rng.int(1, 12);
  const dob = `2016-${String(month).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
  const bowler = role === 'BOWLER' || role === 'ALLROUNDER';
  let state = createNewCareer({
    firstName: 'Sim',
    lastName: String(seed),
    dateOfBirth: dob,
    creationRole: role,
    bowlingStyle: bowler ? rng.pick(['RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX'] as const) : 'RIGHT_ARM_MEDIUM',
    seed,
    startDate: '2026-06-01',
  });
  const reachedAt: SimulatedCareerRun['reachedAt'] = {};
  const establishedAt: SimulatedCareerRun['establishedAt'] = {};
  const age = (date: string) => Math.floor(ageInYears(dob, date));
  const limit = endAge ?? 60;
  let guard = 0;
  let reviews = 0;
  let year = state.season.year;
  let peak = state.player.overall;
  let maxSave = 0;
  while (age(state.season.currentDate) < limit && !state.pro.retirement.complete && guard < 3500) {
    guard += 1;
    state = playOn(state);
    peak = Math.max(peak, state.player.overall);
    // Reached: in a squad at the stage and on the field for it.
    const stageId = state.career.currentStageId;
    if (reachedAt[stageId] === undefined && getStage(stageId).order <= 10) {
      const order = getStage(stageId).order;
      const inSquad = Object.values(state.career.squads).some((p) => IN_SQUAD.includes(p.status) && p.tournamentId !== 'club-league');
      if (order === 1 || (inSquad && state.career.stages[stageId].matchesPlayed > 0)) reachedAt[stageId] = age(state.season.currentDate);
    }
    if (state.career.seasonReviews.length !== reviews) {
      reviews = state.career.seasonReviews.length;
      state = { ...state, career: { ...state.career, pendingReview: null } };
    }
    if (state.season.year !== year) {
      year = state.season.year;
      if (endAge === undefined) state = autoRetire(state, state.season.currentDate);
      if (year % 4 === 0) maxSave = Math.max(maxSave, JSON.stringify(state).length);
    }
  }
  // Stages completed along the way count as reached; senior formats as established.
  const enteredAt: SimulatedCareerRun['enteredAt'] = {};
  const completedAt: SimulatedCareerRun['completedAt'] = {};
  for (const s of CAREER_STAGES) {
    const p = state.career.stages[s.id];
    if (s.id === 'SENIOR_STATE' && p.status === 'COMPLETED' && reachedAt.SENIOR_STATE === undefined) {
      const debut = state.career.events.find((e) => e.kind === 'DEBUT');
      reachedAt.SENIOR_STATE = debut ? age(debut.date) : age(p.completedOn ?? state.season.currentDate);
    }
    if (['RANJI_TROPHY', 'VIJAY_HAZARE', 'SYED_MUSHTAQ_ALI'].includes(s.id) && p.status === 'COMPLETED') {
      establishedAt[s.id] = age(p.completedOn ?? state.season.currentDate);
    }
    if (p.enteredOn) enteredAt[s.id] = age(p.enteredOn);
    if (p.completedOn && p.status === 'COMPLETED') completedAt[s.id] = age(p.completedOn);
    if (s.order >= 11 && (p.status === 'CURRENT' || p.status === 'COMPLETED') && reachedAt[s.id] === undefined) reachedAt[s.id] = age(p.enteredOn ?? state.season.currentDate);
  }
  // Stages 8-10: reached with a first match in that competition.
  const firstIn: Record<string, string> = {};
  for (const m of Object.values(state.matches)) {
    if (!m.userPerformance) continue;
    if (!firstIn[m.tournamentId] || m.date < firstIn[m.tournamentId]) firstIn[m.tournamentId] = m.date;
  }
  for (const [sid, tid] of [['RANJI_TROPHY', 'ranji-trophy'], ['VIJAY_HAZARE', 'vijay-hazare'], ['SYED_MUSHTAQ_ALI', 'syed-mushtaq-ali']] as const) {
    if (firstIn[tid]) reachedAt[sid] = age(firstIn[tid]);
  }
  const matches = Object.values(state.player.record.byFormat).reduce((sum, r) => sum + (r?.batting.matches ?? 0), 0);
  const posts = state.pro.leadership.posts;
  const legacy = legacyRating(state);
  const saveBytes = JSON.stringify(state).length;
  return {
    seed,
    role,
    hiddenPotential: state.player.development.hiddenPotential,
    reachedAt,
    establishedAt,
    enteredAt,
    completedAt,
    outcomes: state.career.seasonReviews.map((r) => r.outcome),
    drops: state.career.drops,
    comebacks: state.career.comebacks,
    finalStageId: state.career.currentStageId,
    finalOverall: state.player.overall,
    peakOverall: peak,
    seasons: state.career.seasonReviews.length,
    matches,
    retiredAt: state.pro.retirement.complete ? age(state.pro.retirement.retiredOn.ALL ?? state.season.currentDate) : null,
    caps: { ...state.pro.national.caps },
    iplSeasons: state.pro.ipl.seasons.filter((x) => x.matches > 0).length,
    iplMatches: state.player.record.byCompetition.ipl?.batting.matches ?? 0,
    captain: {
      state: posts.some((p) => p.level === 'STATE' && p.role === 'CAPTAIN'),
      ipl: posts.some((p) => p.level === 'IPL' && p.role === 'CAPTAIN'),
      india: posts.some((p) => p.level === 'INDIA' && p.role === 'CAPTAIN'),
    },
    legacyTier: legacy.label,
    legacyScore: legacy.score,
    awards: state.pro.awards.length,
    saveBytes,
    maxSaveBytes: Math.max(maxSave, saveBytes),
  };
}

export interface CareerSimReport {
  careers: number;
  byStage: { stageId: CareerStageId; label: string; reached: number; averageAge: number | null; completed: number }[];
  established: { stageId: CareerStageId; label: string; count: number; averageAge: number | null }[];
  outcomes: Record<SeasonOutcome, number>;
  droppedCareers: number;
  drops: number;
  comebacks: number;
  averageMatches: number;
  /** Retired from all cricket, and the average age and career length (from 10). */
  retired: number;
  averageRetirementAge: number | null;
  averageCareerYears: number | null;
  /** Players with a senior debut: when they retired. */
  seniorRetirementAge: number | null;
  capped: number;
  regularInternationals: number;
  captains: { state: number; ipl: number; india: number };
  iplPlayers: number;
  legacy: Record<string, number>;
  averageSaveBytes: number;
  maxSaveBytes: number;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function summarise(runs: SimulatedCareerRun[]): CareerSimReport {
  const byStage = CAREER_STAGES.map((s) => {
    const ages = runs.map((r) => r.reachedAt[s.id]).filter((a): a is number => a !== undefined);
    return { stageId: s.id, label: `${s.order}. ${s.shortLabel}`, reached: ages.length, averageAge: avg(ages), completed: runs.filter((r) => r.completedAt?.[s.id] !== undefined).length };
  });
  const established = (['RANJI_TROPHY', 'VIJAY_HAZARE', 'SYED_MUSHTAQ_ALI'] as CareerStageId[]).map((id) => {
    const ages = runs.map((r) => r.establishedAt[id]).filter((a): a is number => a !== undefined);
    return { stageId: id, label: getStage(id).shortLabel, count: ages.length, averageAge: avg(ages) };
  });
  const outcomes = { PROMOTE: 0, STAY: 0, BENCH: 0, DROPPED: 0, COMEBACK: 0, FAST_TRACK: 0, AGED_OUT: 0 } as Record<SeasonOutcome, number>;
  for (const r of runs) for (const o of r.outcomes) outcomes[o] += 1;
  const retiredAges = runs.map((r) => r.retiredAt).filter((a): a is number => a !== null);
  const legacy: Record<string, number> = {};
  for (const r of runs) legacy[r.legacyTier] = (legacy[r.legacyTier] ?? 0) + 1;
  const caps = (r: SimulatedCareerRun) => r.caps.T20I + r.caps.ODI + r.caps.TEST;
  return {
    careers: runs.length,
    byStage,
    established,
    outcomes,
    droppedCareers: runs.filter((r) => r.drops > 0).length,
    drops: runs.reduce((s, r) => s + r.drops, 0),
    comebacks: runs.reduce((s, r) => s + r.comebacks, 0),
    averageMatches: avg(runs.map((r) => r.matches)) ?? 0,
    retired: retiredAges.length,
    averageRetirementAge: avg(retiredAges),
    averageCareerYears: avg(retiredAges.map((a) => a - 10)),
    seniorRetirementAge: avg(runs.filter((r) => r.reachedAt.SENIOR_STATE !== undefined && r.retiredAt !== null).map((r) => r.retiredAt as number)),
    capped: runs.filter((r) => caps(r) > 0).length,
    regularInternationals: runs.filter((r) => caps(r) >= NATIONAL.regularCaps).length,
    captains: { state: runs.filter((r) => r.captain.state).length, ipl: runs.filter((r) => r.captain.ipl).length, india: runs.filter((r) => r.captain.india).length },
    iplPlayers: runs.filter((r) => r.iplMatches > 0).length,
    legacy,
    averageSaveBytes: Math.round(avg(runs.map((r) => r.saveBytes)) ?? 0),
    maxSaveBytes: Math.max(0, ...runs.map((r) => r.maxSaveBytes)),
  };
}

export function formatReport(report: CareerSimReport): string {
  const pct = (n: number) => `${Math.round((n / report.careers) * 1000) / 10}%`;
  const lines: string[] = [];
  lines.push(`${report.careers} careers from age 10 to retirement, default training, every match on the fast sim`);
  lines.push('');
  lines.push('Stage reached                            careers   share   avg age   completed');
  for (const s of report.byStage) {
    lines.push(`${s.label.padEnd(40)} ${String(s.reached).padStart(7)} ${pct(s.reached).padStart(7)} ${String(s.averageAge ?? '-').padStart(9)} ${String(s.completed).padStart(11)}`);
  }
  lines.push('(1-10: selected and played at the stage; 11-20: entered the stage; 20: retired from a format or all cricket)');
  lines.push('');
  lines.push('Established regular (stages 8-10)');
  for (const e of report.established) lines.push(`${e.label.padEnd(40)} ${String(e.count).padStart(7)} ${pct(e.count).padStart(7)} ${String(e.averageAge ?? '-').padStart(9)}`);
  lines.push('');
  lines.push(`Retired: ${report.retired}; average retirement age ${report.averageRetirementAge ?? '-'}; average career ${report.averageCareerYears ?? '-'} years (from age 10)`);
  lines.push(`Players with a senior debut retire at ${report.seniorRetirementAge ?? '-'} on average`);
  lines.push(`IPL players: ${report.iplPlayers} (${pct(report.iplPlayers)})`);
  lines.push(`Capped by India: ${report.capped} (${pct(report.capped)}); regular internationals (${NATIONAL.regularCaps}+ caps): ${report.regularInternationals} (${pct(report.regularInternationals)})`);
  lines.push(`Captains: state ${report.captains.state}, IPL ${report.captains.ipl}, India ${report.captains.india}`);
  lines.push(`Legacy: ${Object.entries(report.legacy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  lines.push(`Season outcomes: ${Object.entries(report.outcomes).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ')}`);
  lines.push(`Careers with a drop: ${report.droppedCareers}; drops ${report.drops}; comebacks ${report.comebacks}`);
  lines.push(`Average matches per career: ${report.averageMatches}`);
  lines.push(`Save size at retirement: average ${(report.averageSaveBytes / 1e6).toFixed(2)} MB, largest seen ${(report.maxSaveBytes / 1e6).toFixed(2)} MB`);
  return lines.join('\n');
}
