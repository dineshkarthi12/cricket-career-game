/**
 * The real-player converter (`scripts/players`, run by `npm run import:players`):
 * the two squad-list formats, name matching, and a whole conversion on a
 * small fixture of hand-made Cricsheet matches.
 */
import { describe, expect, it } from 'vitest';
import { parseListedName, parseRanjiList, parseVhtList, gameSideOf } from '../../scripts/players/squadLists.ts';
import { matchListedName, nameParts, nameScore, surnameCounts, type Candidate } from '../../scripts/players/names.ts';
import { summariseMatch, classify } from '../../scripts/players/cricsheet.ts';
import { StatsDb, S, seasonWeight, weightedStats } from '../../scripts/players/stats.ts';
import { batHandOf, bowlStyleOf, convert, displayNameFor, roleFromStats } from '../../scripts/players/convert.ts';

describe('the Ranji squad list', () => {
  const text = [
    'Ranji Trophy 2025-26 squads',
    'Bengal cricket team: Abhimanyu Easwaran (c), Abishek Porel (vc/wk), Mohammed Shami, Akash Deep',
    '',
    'Hyderabad cricket team: Tilak Varma (c), Rahul Radesh (wk) Standbyes: P. Nitish Reddy, Mikhil Jaiswal',
    'Delhi cricket team: Ayush Badoni (c), Rohan Rana, Aryan Rana (subject to fitness).',
    'Kerala cricket team: Mohammed Azharuddeen (C), Baba Aparajith (VC), Sanju Samson',
    'Andhra Pradesh cricket team: Y Prithvi Raj, KV Sasikanth',
    'Mumbai cricket team: Sylvester D’Souza, Irfan Umair',
  ].join('\n');
  const squads = parseRanjiList(text);

  it('reads every side and maps its name onto the game', () => {
    expect(squads.map((s) => s.team)).toEqual(['Bengal', 'Hyderabad', 'Delhi', 'Kerala', 'Andhra', 'Mumbai']);
    expect(gameSideOf('Andhra Pradesh')).toBe('Andhra');
    expect(gameSideOf('Hyderabad (India)')).toBe('Hyderabad');
    expect(gameSideOf('Jammu & Kashmir')).toBe('Jammu & Kashmir');
    expect(gameSideOf('[JAMMU & KASHMIR]')).toBe('Jammu & Kashmir');
  });

  it('keeps captains, vice-captains and keepers from the markers, in any case', () => {
    const bengal = squads[0].players;
    expect(bengal[0]).toMatchObject({ name: 'Abhimanyu Easwaran', captain: true, keeper: false });
    expect(bengal[1]).toMatchObject({ name: 'Abishek Porel', viceCaptain: true, keeper: true, captain: false });
    const kerala = squads[3].players;
    expect(kerala[0]).toMatchObject({ name: 'Mohammed Azharuddeen', captain: true });
    expect(kerala[1]).toMatchObject({ name: 'Baba Aparajith', viceCaptain: true });
  });

  it('marks standbys, even straight after a name, and keeps notes out of names', () => {
    const hyd = squads[1].players;
    expect(hyd.map((p) => p.name)).toEqual(['Tilak Varma', 'Rahul Radesh', 'P. Nitish Reddy', 'Mikhil Jaiswal']);
    expect(hyd.map((p) => p.standby)).toEqual([false, false, true, true]);
    expect(hyd[1].keeper).toBe(true);
    const delhi = squads[2].players;
    expect(delhi[2]).toMatchObject({ name: 'Aryan Rana', note: 'subject to fitness' });
    expect(squads[5].players[0].name).toBe("Sylvester D'Souza");
  });

  it('parses a single listed name', () => {
    expect(parseListedName('  Ali Kachi Diamond (wk) ')).toMatchObject({ name: 'Ali Kachi Diamond', keeper: true });
    expect(parseListedName('(c)')).toBeNull();
  });
});

describe('the Vijay Hazare squad list', () => {
  const text = [
    'VIJAY HAZARE TROPHY 2024-25',
    'ALL TEAM-WISE PLAYERS LIST',
    'Source reference: CREX VHT 2024-25 squad page + published VHT 2024-25 squad lists.',
    'Note: the page is dynamically rendered, so the lists below use the published compilation.',
    '',
    '[ANDHRA]',
    'Prithvi Raj, Ricky Bhui, Srikar Bharat',
    '',
    '[JAMMU & KASHMIR]',
    'Abdul Samad, Umran Malik (c)',
    '',
    '[UTTAR PRADESH - NOTE]',
    'CREX lists Uttar Pradesh as the final team in its 38-team index.',
    '',
    'TOTAL TEAMS: 38',
  ].join('\n');

  it('skips the notes and reads one line of names per team', () => {
    const squads = parseVhtList(text);
    expect(squads.map((s) => [s.source, s.team, s.players.length])).toEqual([
      ['ANDHRA', 'Andhra', 3],
      ['JAMMU & KASHMIR', 'Jammu & Kashmir', 2],
    ]);
    expect(squads[1].players[1]).toMatchObject({ name: 'Umran Malik', captain: true });
  });
});

describe('name matching', () => {
  it('splits Cricsheet names into initials and words', () => {
    expect(nameParts('GH Vihari')).toEqual({ words: ['vihari'], initials: ['g', 'h'] });
    expect(nameParts('K V Sasikanth')).toEqual({ words: ['sasikanth'], initials: ['k', 'v'] });
    expect(nameParts('Basil NP')).toEqual({ words: ['basil'], initials: ['n', 'p'] });
  });

  it('matches full names to initials, in either order, and spelling variants', () => {
    expect(nameScore('Hanuma Vihari', 'GH Vihari')).not.toBeNull();
    expect(nameScore('Narayan Jagadeesan', 'N Jagadeesan')).not.toBeNull();
    expect(nameScore('KV Sasikanth', 'K V Sasikanth')).not.toBeNull();
    expect(nameScore('Abishek Porel', 'Abhishek Porel')).not.toBeNull();
    expect(nameScore('Sai Sudharsan', 'B Sai Sudharsan')).not.toBeNull();
    // An exact name beats an initials match.
    expect(nameScore('Ravi Bishnoi', 'Ravi Bishnoi')!).toBeGreaterThan(nameScore('Hanuma Vihari', 'GH Vihari')!);
  });

  it('rejects a different given name or surname', () => {
    expect(nameScore('Rahul Singh', 'Rinku Singh')).toBeNull();
    expect(nameScore('Yashasvi Jaiswal', 'SS Jaiswal')).toBeNull();
    expect(nameScore('Hanuma Vihari', 'KS Bharat')).toBeNull();
  });

  const candidates: Candidate[] = [
    { id: 'vihari', names: ['GH Vihari'], states: ['Andhra'], lastYear: 2024 },
    { id: 'rk-singh', names: ['RK Singh'], states: ['Uttar Pradesh'], lastYear: 2024 },
    { id: 'r-singh-2', names: ['R Singh'], states: ['Assam'], lastYear: 2024 },
    { id: 'ra-singh', names: ['RA Singh'], states: ['Punjab'], lastYear: 2023 },
    { id: 'axar', names: ['AR Patel'], fullNames: ['axar rajeshbhai patel'], states: ['Gujarat'], lastYear: 2025 },
    { id: 'yd', names: ['Yash Dayal'], states: ['Uttar Pradesh'], lastYear: 2025 },
    { id: 'rohit-a', names: ['Rohit Sharma'], states: [], lastYear: 2024 },
    { id: 'rohit-b', names: ['Rohit Sharma'], states: [], lastYear: 2024 },
  ];
  const counts = surnameCounts(candidates);

  it('uses the state side to pick between players who share a surname', () => {
    expect(matchListedName('Hanuma Vihari', 'Tripura', candidates, 2024, counts)).toMatchObject({ id: 'vihari', reason: 'matched' });
    expect(matchListedName('Rahul Singh', 'Assam', candidates, 2024, counts)).toMatchObject({ id: 'r-singh-2', reason: 'matched' });
    // A common surname on an initial alone, from another side: not trusted.
    expect(matchListedName('Rahul Singh', 'Bihar', candidates, 2024, counts).id).toBeNull();
  });

  it('never matches a known full name with a different given name, or a misspelt surname from another side', () => {
    expect(matchListedName('Aditya Patel', 'Gujarat', candidates, 2024, counts).id).toBeNull();
    expect(matchListedName('Yash Dalal', 'Haryana', candidates, 2024, counts).id).toBeNull();
  });

  it('reports a tie as ambiguous instead of guessing', () => {
    const r = matchListedName('Rohit Sharma', 'Jammu & Kashmir', candidates, 2024, counts);
    expect(r.reason).toBe('ambiguous');
    expect(r.id).toBeNull();
    expect(r.alternatives.map((a) => a.id).sort()).toEqual(['rohit-a', 'rohit-b']);
  });
});

describe('styles, roles and names', () => {
  it('maps Kaggle styles onto the game', () => {
    expect(batHandOf('Left hand Bat')).toBe('L');
    expect(bowlStyleOf('Slow Left arm Orthodox')).toBe('LEFT_ARM_ORTHODOX');
    expect(bowlStyleOf('Right arm Medium fast')).toBe('RIGHT_ARM_FAST_MEDIUM');
    expect(bowlStyleOf('Legbreak Googly')).toBe('LEG_SPIN');
    expect(bowlStyleOf('Right arm Offbreak, Legbreak')).toBe('OFF_SPIN');
    expect(bowlStyleOf('Left arm Fast')).toBe('LEFT_ARM_FAST');
    expect(bowlStyleOf(' ')).toBeNull();
  });

  it('reads a role from the figures', () => {
    // T20 line: m, inn, runs, balls, outs, 4s, 6s, bb, br, wk, ct, st, pos
    expect(roleFromStats({ IPL: [20, 20, 700, 500, 18, 60, 30, 0, 0, 0, 8, 0, 1.6] }, 'NONE', false).role).toBe('OB');
    expect(roleFromStats({ IPL: [20, 8, 60, 50, 6, 4, 2, 480, 600, 25, 5, 0, 9.5] }, 'RIGHT_ARM_FAST', false).role).toBe('PB');
    expect(roleFromStats({ IPL: [20, 8, 60, 50, 6, 4, 2, 480, 600, 25, 5, 0, 9.5] }, 'LEG_SPIN', false).role).toBe('SB');
    expect(roleFromStats({ IPL: [20, 18, 450, 330, 15, 30, 20, 400, 520, 18, 6, 0, 5] }, 'LEFT_ARM_ORTHODOX', false).role).toBe('AR');
    expect(roleFromStats({ IPL: [20, 18, 450, 330, 15, 30, 20, 0, 0, 0, 14, 5, 4] }, 'NONE', false).role).toBe('WK');
    // One stumping as a stand-in keeper in 200 matches is not a keeper.
    expect(roleFromStats({ ODI: [200, 190, 6000, 6500, 180, 600, 100, 0, 0, 0, 90, 1, 3] }, 'NONE', false).role).toBe('BA');
    expect(roleFromStats({}, 'NONE', true).role).toBe('WK');
  });

  it('expands initials from the full name, but not for players known by them', () => {
    expect(displayNameFor('V Kohli', 'Virat Kohli')).toBe('Virat Kohli');
    expect(displayNameFor('Q de Kock', 'Quinton de Kock')).toBe('Quinton de Kock');
    expect(displayNameFor('KL Rahul', 'Kannaur Lokesh Rahul')).toBe('KL Rahul');
    expect(displayNameFor('BKG Mendis', 'Balapuwaduge Kusal Mendis', 'Sri Lanka')).toBe('BKG Mendis');
    expect(displayNameFor('Washington Sundar', 'Washington Sundar')).toBe('Washington Sundar');
  });
});

// --- A whole conversion on a fixture ---------------------------------------------------------

type Ball = [batter: string, bowler: string, runs: number, wicket?: { kind: string; out: string; fielder?: string }];

/** A Cricsheet JSON match (v1.x) from a list of balls per innings. */
function jsonMatch(opts: { event?: string; type: string; teamType: string; date: string; teams: Record<string, string[]>; innings: [string, Ball[]][] }): Record<string, unknown> {
  const people: Record<string, string> = {};
  for (const xi of Object.values(opts.teams)) for (const n of xi) people[n] = `id-${n.replace(/\W+/g, '').toLowerCase()}`;
  return {
    info: {
      dates: [opts.date],
      ...(opts.event ? { event: { name: opts.event } } : {}),
      gender: 'male',
      match_type: opts.type,
      team_type: opts.teamType,
      teams: Object.keys(opts.teams),
      players: opts.teams,
      registry: { people },
    },
    innings: opts.innings.map(([team, balls]) => ({
      team,
      overs: [
        {
          over: 0,
          deliveries: balls.map(([batter, bowler, runs, w]) => ({
            batter,
            bowler,
            non_striker: batter,
            runs: { batter: runs, extras: 0, total: runs },
            ...(w ? { wickets: [{ kind: w.kind, player_out: w.out, ...(w.fielder ? { fielders: [{ name: w.fielder }] } : {}) }] } : {}),
          })),
        },
      ],
    })),
  };
}

const TN = ['N Jagadeesan', 'B Sai Sudharsan', 'R Sai Kishore', 'T Natarajan', 'M Shahrukh Khan', 'TN6', 'TN7', 'TN8', 'TN9', 'TN10', 'TN11'];
const KA = ['KL Rahul', 'R Smaran', 'Vijaykumar Vyshak', 'KA4', 'KA5', 'KA6', 'KA7', 'KA8', 'KA9', 'KA10', 'KA11'];
const AUS = ['TM Head', 'PJ Cummins', 'AUS3', 'AUS4', 'AUS5', 'AUS6', 'AUS7', 'AUS8', 'AUS9', 'AUS10', 'AUS11'];
const IND = ['V Kohli', 'KL Rahul', 'JJ Bumrah', 'IND4', 'IND5', 'IND6', 'IND7', 'IND8', 'IND9', 'IND10', 'IND11'];

function fixtureDb(): StatsDb {
  const db = new StatsDb();
  const smat = jsonMatch({
    event: 'Syed Mushtaq Ali Trophy',
    type: 'T20',
    teamType: 'club',
    date: '2024-11-25',
    teams: { 'Tamil Nadu': TN, Karnataka: KA },
    innings: [
      ['Tamil Nadu', [['N Jagadeesan', 'Vijaykumar Vyshak', 4], ['N Jagadeesan', 'Vijaykumar Vyshak', 6], ['B Sai Sudharsan', 'Vijaykumar Vyshak', 1], ['N Jagadeesan', 'R Smaran', 0, { kind: 'stumped', out: 'N Jagadeesan', fielder: 'KL Rahul' }]]],
      ['Karnataka', [['KL Rahul', 'T Natarajan', 2], ['KL Rahul', 'R Sai Kishore', 0, { kind: 'caught', out: 'KL Rahul', fielder: 'M Shahrukh Khan' }], ['R Smaran', 'T Natarajan', 0, { kind: 'bowled', out: 'R Smaran' }]]],
    ],
  });
  const test = jsonMatch({
    type: 'Test',
    teamType: 'international',
    date: '2026-01-03',
    teams: { India: IND, Australia: AUS },
    innings: [
      ['India', [['V Kohli', 'PJ Cummins', 4], ['V Kohli', 'PJ Cummins', 0, { kind: 'caught', out: 'V Kohli', fielder: 'TM Head' }]]],
      ['Australia', [['TM Head', 'JJ Bumrah', 0, { kind: 'lbw', out: 'TM Head' }]]],
    ],
  });
  const ipl = jsonMatch({
    event: 'Indian Premier League',
    type: 'T20',
    teamType: 'club',
    date: '2026-04-10',
    teams: { 'Royal Challengers Bengaluru': ['V Kohli', 'RCB2', 'RCB3', 'RCB4', 'RCB5', 'RCB6', 'RCB7', 'RCB8', 'RCB9', 'RCB10', 'RCB11'], 'Sunrisers Hyderabad': ['TM Head', 'PJ Cummins', 'SRH3', 'SRH4', 'SRH5', 'SRH6', 'SRH7', 'SRH8', 'SRH9', 'SRH10', 'SRH11'] },
    innings: [['Royal Challengers Bengaluru', [['V Kohli', 'PJ Cummins', 6]]]],
  });
  const other = jsonMatch({ event: 'Big Bash League', type: 'T20', teamType: 'club', date: '2025-12-20', teams: { A: ['x'], B: ['y'] }, innings: [] });
  for (const [id, raw] of [['1', smat], ['2', test], ['3', ipl], ['4', other], ['1', smat]] as const) {
    const summary = summariseMatch(id, raw);
    if (summary) db.add(summary);
    else db.skip(id);
  }
  return db;
}

describe('Cricsheet matches and figures', () => {
  it('classifies competitions and skips the ones the game does not use', () => {
    expect(classify({ match_type: 'T20', team_type: 'club', event: { name: 'Indian Premier League' } })).toBe('IPL');
    expect(classify({ match_type: 'T20', competition: 'Syed Mushtaq Ali Trophy' })).toBe('SMAT');
    expect(classify({ match_type: 'T20', team_type: 'international' })).toBe('T20I');
    expect(classify({ match_type: 'Test', team_type: 'international' })).toBe('TEST');
    expect(classify({ match_type: 'T20', team_type: 'club', event: { name: 'Big Bash League' } })).toBeNull();
    expect(classify({ match_type: 'ODI', gender: 'female' })).toBeNull();
  });

  it('counts runs, balls, boundaries, wickets, catches and stumpings, once per match id', () => {
    const db = fixtureDb();
    expect(db.matches).toMatchObject({ SMAT: 1, TEST: 1, IPL: 1, ODI: 0 });
    const jag = db.players.get('id-njagadeesan')!;
    const smat = jag.years.SMAT!.get(2024)!;
    expect([smat[S.runs], smat[S.balls], smat[S.fours], smat[S.sixes], smat[S.outs]]).toEqual([10, 3, 1, 1, 1]);
    const rahul = db.players.get('id-klrahul')!;
    expect(rahul.years.SMAT!.get(2024)![S.st]).toBe(1);
    const smaran = db.players.get('id-rsmaran')!;
    expect(smaran.stumpedOffBowling).toBe(1);
    expect(db.players.get('id-rsaikishore')!.years.SMAT!.get(2024)![S.wk]).toBe(1);
    expect(db.players.get('id-mshahrukhkhan')!.years.SMAT!.get(2024)![S.ct]).toBe(1);
  });

  it('weights the last three seasons in full and older ones less', () => {
    expect([0, 1, 2, 3, 5, 6].map(seasonWeight)).toEqual([1, 1, 1, 0.5, 0.5, 0.25]);
    const db = fixtureDb();
    const w = weightedStats(db.players.get('id-njagadeesan')!, 'SMAT', 2030)!;
    // Six seasons old: a quarter.
    expect(w[S.runs]).toBe(2.5);
  });
});

describe('the conversion', () => {
  const ranji = parseRanjiList('Tamil Nadu cricket team: Narayan Jagadeesan (c), Sai Sudharsan, Ravisrinivasan Sai Kishore, Unknown Player (wk)\nKarnataka cricket team: KL Rahul, Ravichandran Smaran');
  const vht = parseVhtList('[TAMIL NADU]\nNarayan Jagadeesan, Thangarasu Natarajan, M Shahrukh Khan\n[KARNATAKA]\nVijaykumar Vyshak, Smaran R');
  const kaggle = new Map([
    ['V Kohli', { bat: 'Right hand Bat', bowl: 'Right arm Medium', full: 'Virat Kohli' }],
    ['TM Head', { bat: 'Left hand Bat', bowl: 'Right arm Offbreak', full: 'Travis Michael Head', keeper: true }],
    ['T Natarajan', { bat: 'Left hand Bat', bowl: 'Left arm Medium fast', full: 'Thangarasu Natarajan' }],
  ]);
  const out = convert({ db: fixtureDb(), kaggle, ranji, vht, season: 2026 });
  const byId = new Map([...out.domestic.players, ...out.ipl.players, ...out.international.players].map((p) => [p.id, p]));

  it('matches listed names to their figures and keeps the captain', () => {
    const tn = out.domestic.squads['Tamil Nadu'];
    expect(tn.ranji.slice(0, 3)).toEqual(['id-njagadeesan', 'id-bsaisudharsan', 'id-rsaikishore']);
    expect(tn.captains.ranji).toBe('id-njagadeesan');
    expect(tn.vht).toEqual(['id-njagadeesan', 'id-tnatarajan', 'id-mshahrukhkhan']);
    expect(byId.get('id-njagadeesan')!.n).toBe('Narayan Jagadeesan');
    // A player in both lists is one player, in both squads.
    expect(out.domestic.players.filter((p) => p.id === 'id-njagadeesan')).toHaveLength(1);
  });

  it('builds the SMAT squad from the side\'s recent SMAT players', () => {
    const tn = out.domestic.squads['Tamil Nadu'].smat;
    for (const id of ['id-njagadeesan', 'id-tnatarajan', 'id-rsaikishore']) expect(tn).toContain(id);
  });

  it('flags a listed player with no figures, with a guessed role, and lists them for checking', () => {
    const unknown = out.domestic.squads['Tamil Nadu'].ranji[3];
    expect(unknown).toMatch(/^u-tamil-nadu-unknown-player/);
    const rec = byId.get(unknown)!;
    expect(rec.r).toBe('WK'); // from (wk)
    expect(rec.g & 16).toBeTruthy();
    expect(out.report.unmatched).toContainEqual({ team: 'Tamil Nadu', list: 'ranji', name: 'Unknown Player' });
    expect(out.report.noStats.map((n) => n.id)).toContain(unknown);
  });

  it('takes styles from Kaggle, infers the rest and lists every guess', () => {
    expect(byId.get('id-tnatarajan')).toMatchObject({ h: 'L', bw: 'LEFT_ARM_FAST_MEDIUM' });
    // R Smaran: a stumping off his bowling, no Kaggle entry -> off-spin, guessed.
    const smaran = byId.get('id-rsmaran')!;
    expect(smaran.bw).toBe('OFF_SPIN');
    expect(out.report.styleGuesses.some((g) => g.id === 'id-rsmaran' && /stumped/.test(g.basis))).toBe(true);
    // Ages come from the first recorded match, and are listed.
    expect(out.report.ageEstimates.find((a) => a.id === 'id-njagadeesan')?.birthYear).toBe(2024 - 21);
  });

  it('builds national squads from internationals and IPL squads from the latest season', () => {
    expect(out.international.squads.India).toContain('id-vkohli');
    expect(out.international.squads.Australia).toContain('id-tmhead');
    expect(byId.get('id-tmhead')).toMatchObject({ c: 'Australia', cap: 1, h: 'L' });
    // Kaggle calls Head a keeper, but he has no stumping: not a keeper.
    expect(byId.get('id-tmhead')!.r).not.toBe('WK');
    expect(out.ipl.squads['Royal Challengers Bengaluru']).toContain('id-vkohli');
    expect(out.ipl.squads['Sunrisers Hyderabad']).toEqual(expect.arrayContaining(['id-tmhead', 'id-pjcummins']));
    expect(byId.get('id-vkohli')!.n).toBe('Virat Kohli');
  });

  it('obeys a manual override', () => {
    const fixed = convert({ db: fixtureDb(), kaggle, ranji, vht, season: 2026, manual: { matches: { 'Tamil Nadu|Unknown Player': 'id-tn6' }, players: { 'id-njagadeesan': { birthYear: 1996, name: 'N. Jagadeesan' } } } });
    expect(fixed.domestic.squads['Tamil Nadu'].ranji[3]).toBe('id-tn6');
    const jag = fixed.domestic.players.find((p) => p.id === 'id-njagadeesan')!;
    expect(jag).toMatchObject({ y: 1996, n: 'N. Jagadeesan' });
    expect(jag.g & 1).toBe(0);
  });
});
