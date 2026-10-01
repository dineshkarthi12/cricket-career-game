/**
 * The manager's career: the season review, promotion (earned, never
 * automatic), the sack, job offers, milestones and retirement. Retiring is
 * the manager's own decision and keeps the whole history.
 */
import type { ManagerRank, ManagerState, SeasonSummary } from '@/types/manager';
import { MANAGER } from './config';
import { evaluateObjectives } from './board';
import { financeReport } from './finance';
import { rankStandings } from './matchday';
import { marketValue } from './players';
import type { ActionResult } from './scouting';
import { addNews, clamp, once, produce, squadOf } from './util';

export function rankLabel(rank: ManagerRank): string {
  return MANAGER.ranks.label[rank];
}

function nextRank(rank: ManagerRank): ManagerRank | null {
  const order = MANAGER.ranks.order;
  const i = order.indexOf(rank);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

/** What it takes to step up from the current rank, and how close the manager is. */
export function promotionOutlook(state: ManagerState): { next: ManagerRank | null; reputationNeeded: number | null; objectiveShare: number | null } {
  const next = nextRank(state.profile.rank);
  const rule = MANAGER.ranks.promotion[state.profile.rank];
  return { next, reputationNeeded: rule?.reputation ?? null, objectiveShare: rule?.objectiveShare ?? null };
}

/**
 * The end-of-season review. Writes the objectives' verdicts, moves
 * reputation and board confidence, and decides: promoted, retained, warned
 * or sacked. Runs once per season.
 */
export function seasonReview(draft: ManagerState): SeasonSummary | null {
  if (!once(draft, `review-${draft.season.year}`)) return null;
  const objectives = evaluateObjectives(draft);
  draft.season.objectives = objectives;
  const totalWeight = objectives.reduce((n, o) => n + o.weight, 0) || 1;
  const metWeight = objectives.filter((o) => o.met).reduce((n, o) => n + o.weight, 0);
  const share = metWeight / totalWeight;

  const table = rankStandings(draft.season.standings);
  const position = table.findIndex((s) => s.franchiseId === draft.franchiseId) + 1;
  const row = table.find((s) => s.franchiseId === draft.franchiseId);
  const final = draft.season.fixtures.find((f) => f.stage === 'FINAL');
  const champions = final?.result?.winnerId === draft.franchiseId;
  const inFinal = Boolean(final && (final.homeId === draft.franchiseId || final.awayId === draft.franchiseId));
  const playoffs = draft.season.fixtures.some((f) => f.stage !== 'LEAGUE' && (f.homeId === draft.franchiseId || f.awayId === draft.franchiseId));
  const profit = financeReport(draft).profit;
  const r = MANAGER.reputation;
  const responsibleForResults = MANAGER.ranks.responsibilities[draft.profile.rank].includes('MATCHDAY');
  const resultWeight = responsibleForResults ? 1 : 0.35;

  let change = 0;
  if (champions) change += r.title * resultWeight;
  else if (inFinal) change += r.final * resultWeight;
  else if (playoffs) change += r.playoffs * resultWeight;
  else change += r.missedPlayoffs * resultWeight;
  for (const o of objectives) change += o.met ? r.objectiveMet : r.objectiveMissed * (o.weight / 2);
  change += profit >= 0 ? r.profit : r.loss;
  const before = draft.profile.reputation;
  draft.profile.reputation = clamp(Math.round((draft.profile.reputation + change) * 10) / 10, 0, 100);
  draft.profile.boardConfidence = clamp(Math.round(draft.profile.boardConfidence * 0.6 + share * 60 + (profit >= 0 ? 6 : -8)), 0, 100);
  draft.profile.seasonsManaged += 1;
  if (champions) draft.profile.trophies += 1;
  if (inFinal) draft.profile.finals += 1;
  if (playoffs) draft.profile.playoffApps += 1;

  // The verdict.
  let verdict: SeasonSummary['boardVerdict'] = 'RETAINED';
  const rule = MANAGER.ranks.promotion[draft.profile.rank];
  const next = nextRank(draft.profile.rank);
  if (responsibleForResults && draft.profile.boardConfidence < MANAGER.board.sackBelow) verdict = 'SACKED';
  else if (next && rule && draft.profile.reputation >= rule.reputation && share >= rule.objectiveShare) verdict = 'PROMOTED';
  else if (draft.profile.boardConfidence < MANAGER.board.warnBelow) verdict = 'WARNED';

  const squad = squadOf(draft, draft.franchiseId);
  const topScorer = [...squad].sort((a, b) => b.season.runs - a.season.runs)[0];
  const topWickets = [...squad].sort((a, b) => b.season.wickets - a.season.wickets)[0];
  const bestSigning = [...squad]
    .filter((p) => p.contract && p.contract.signedSeason === draft.season.year && p.season.matches > 0)
    .sort((a, b) => marketValue(b) - (b.contract?.salary ?? 0) - (marketValue(a) - (a.contract?.salary ?? 0)))[0];

  const summary: SeasonSummary = {
    season: draft.season.year,
    franchiseId: draft.franchiseId,
    rank: draft.profile.rank,
    position,
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    lost: row?.lost ?? 0,
    playoffs,
    result: champions ? 'CHAMPIONS' : inFinal ? 'RUNNERS_UP' : playoffs ? 'PLAYOFFS' : 'LEAGUE',
    profit,
    objectivesMet: objectives.filter((o) => o.met).length,
    objectivesTotal: objectives.length,
    reputationChange: Math.round((draft.profile.reputation - before) * 10) / 10,
    bestSigningId: bestSigning?.id ?? null,
    topScorerId: topScorer?.season.runs ? topScorer.id : null,
    topWicketTakerId: topWickets?.season.wickets ? topWickets.id : null,
    boardVerdict: verdict,
  };
  draft.history.push(summary);

  if (verdict === 'PROMOTED' && next) {
    draft.profile.rank = next;
    draft.profile.boardConfidence = Math.max(draft.profile.boardConfidence, 60);
    addNews(draft, { kind: 'CAREER', title: `Promoted: ${rankLabel(next)}`, body: `The board has seen enough. New responsibilities: ${MANAGER.ranks.responsibilities[next].filter((x) => !MANAGER.ranks.responsibilities[summary.rank].includes(x)).map((x) => x.toLowerCase()).join(', ')}.`, route: '/manager/profile' });
  } else if (verdict === 'SACKED') {
    draft.profile.unemployed = true;
    addNews(draft, { kind: 'CAREER', title: 'Sacked', body: 'The board has lost confidence and relieved you of your duties. Your record stands; look at the offers that come in.', route: '/manager/profile' });
  } else if (verdict === 'WARNED') {
    addNews(draft, { kind: 'BOARD', title: 'A warning from the board', body: 'Results and objectives must improve next season.', route: '/manager/profile' });
  } else {
    addNews(draft, { kind: 'BOARD', title: 'Season review', body: `The board is satisfied for now. ${summary.objectivesMet}/${summary.objectivesTotal} objectives met.`, route: '/manager/season-summary' });
  }
  checkMilestones(draft);
  return summary;
}

export const ACHIEVEMENTS: Record<string, string> = {
  FIRST_TITLE: 'First IPL title',
  FIRST_PLAYOFFS: 'First playoff campaign',
  FIRST_FINAL: 'First final',
  HEAD_COACH: 'Appointed Head Coach',
  DIRECTOR: 'Director of Cricket',
  ELITE: 'Elite manager (reputation 80+)',
  DYNASTY: 'Dynasty: three titles',
  LEGEND: 'Ten seasons in the job',
  SCOUT_EYE: 'Discovered five prospects',
  PROFIT_MAKER: 'Three profitable seasons',
};

export function checkMilestones(draft: ManagerState): void {
  const p = draft.profile;
  const give = (id: keyof typeof ACHIEVEMENTS) => {
    if (p.achievements.includes(id)) return;
    p.achievements.push(id);
    addNews(draft, { kind: 'CAREER', title: `Milestone: ${ACHIEVEMENTS[id]}`, body: 'Added to your legacy.', route: '/manager/legacy' });
  };
  if (p.trophies >= 1) give('FIRST_TITLE');
  if (p.playoffApps >= 1) give('FIRST_PLAYOFFS');
  if (p.finals >= 1) give('FIRST_FINAL');
  if (p.rank === 'HEAD_COACH' || p.rank === 'DIRECTOR_OF_CRICKET') give('HEAD_COACH');
  if (p.rank === 'DIRECTOR_OF_CRICKET') give('DIRECTOR');
  if (p.reputation >= MANAGER.milestones.eliteReputation) give('ELITE');
  if (p.trophies >= MANAGER.milestones.dynastyTitles) give('DYNASTY');
  if (p.seasonsManaged >= MANAGER.milestones.legendSeasons) give('LEGEND');
  if (p.discoveries.length >= 5) give('SCOUT_EYE');
  if (draft.history.filter((h) => h.profit >= 0).length >= 3) give('PROFIT_MAKER');
}

/** Franchises that would take on a manager who has been sacked: weaker brands first. */
export function jobOffers(state: ManagerState): { franchiseId: string; rank: ManagerRank }[] {
  if (!state.profile.unemployed) return [];
  const rep = state.profile.reputation;
  return Object.values(state.franchises)
    .filter((f) => f.id !== state.franchiseId)
    .sort((a, b) => a.brand - b.brand)
    .slice(0, rep >= 50 ? 3 : rep >= 30 ? 2 : 1)
    .map((f) => ({ franchiseId: f.id, rank: (rep >= 45 ? 'HEAD_COACH' : 'ASSISTANT_COACH') as ManagerRank }));
}

export function acceptJob(state: ManagerState, franchiseId: string): ActionResult {
  const offer = jobOffers(state).find((o) => o.franchiseId === franchiseId);
  if (!offer) return { ok: false, state, error: 'That job is not on offer.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `job-${d.season.year}-${franchiseId}`)) return;
      d.franchises[d.franchiseId].isUser = false;
      d.franchises[franchiseId].isUser = true;
      d.franchiseId = franchiseId;
      d.profile.rank = offer.rank;
      d.profile.unemployed = false;
      d.profile.boardConfidence = 55;
      d.shortlist = [];
      d.auctionPlan = { targets: [], overseasWanted: 4, rolePriorities: [] };
      addNews(d, { kind: 'CAREER', title: `New job: ${d.franchises[franchiseId].name}`, body: `Appointed ${rankLabel(offer.rank)}. A fresh start.`, route: '/manager' });
    }),
  };
}

/** Retire: the career ends by the manager's choice. Nothing is deleted. */
export function retireManager(state: ManagerState): ActionResult {
  if (state.profile.retired) return { ok: false, state, error: 'Already retired.' };
  if (state.season.phase !== 'SEASON_END' && !state.profile.unemployed) return { ok: false, state, error: 'Retire at the end of a season.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      d.profile.retired = true;
      d.profile.retiredSeason = d.season.year;
      addNews(d, { kind: 'CAREER', title: 'Retired', body: `${d.profile.name} steps away after ${d.profile.seasonsManaged} season${d.profile.seasonsManaged === 1 ? '' : 's'}. The legacy is written.`, route: '/manager/legacy' });
    }),
  };
}

/** The legacy, in numbers. */
export function legacySummary(state: ManagerState) {
  const h = state.history;
  const played = h.reduce((n, s) => n + s.played, 0);
  const won = h.reduce((n, s) => n + s.won, 0);
  const best = state.records.bestSigning ? state.players[state.records.bestSigning.playerId] : null;
  return {
    seasons: h.length,
    played,
    won,
    winRate: played ? Math.round((won / played) * 100) : 0,
    titles: state.profile.trophies,
    finals: state.profile.finals,
    playoffs: state.profile.playoffApps,
    discoveries: state.profile.discoveries.map((id) => state.players[id]).filter(Boolean),
    bestSigning: best,
    totalProfit: h.reduce((n, s) => n + s.profit, 0),
    peakReputation: Math.max(state.profile.reputation, ...h.map(() => 0)),
    achievements: state.profile.achievements.map((id) => ACHIEVEMENTS[id] ?? id),
  };
}
