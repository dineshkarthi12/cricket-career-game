/**
 * Hand-kept inputs for `scripts/build-pvp-cards.ts`.
 *
 * DISPLAY_NAMES: the data's name -> the name printed on the card (the data
 * often uses initials, e.g. "SL Malinga").
 *
 * EXTRA_PLAYERS: greats who retired before the data begins (2005), so they
 * have no figures. Their skills are gameplay judgements on the same 1-99
 * scale as the generated ones; `real` is the overall the ranking uses.
 */
export interface ExtraPlayer {
  name: string;
  country: string;
  role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
  bat: 'R' | 'L';
  bowl: string;
  real: number;
  skills: { batting: number; bowling: number; fielding: number; fitness: number; mental: number };
}

export const DISPLAY_NAMES: Record<string, string> = {
  'AN Cook': 'Alastair Cook',
  'BC Lara': 'Brian Lara',
  'Christopher Gayle': 'Chris Gayle',
  'Christopher Woakes': 'Chris Woakes',
  'Francois du Plessis': 'Faf du Plessis',
  'GP Thorpe': 'Graham Thorpe',
  'JM Anderson': 'James Anderson',
  'JN Gillespie': 'Jason Gillespie',
  'Jonathan Bairstow': 'Jonny Bairstow',
  'KC Sangakkara': 'Kumar Sangakkara',
  'SL Malinga': 'Lasith Malinga',
  'DPMD Jayawardene': 'Mahela Jayawardene',
  'ME Trescothick': 'Marcus Trescothick',
  'MP Vaughan': 'Michael Vaughan',
  'M Muralitharan': 'Muttiah Muralitharan',
  'Luteru Taylor': 'Ross Taylor',
  'ST Jayasuriya': 'Sanath Jayasuriya',
  'SCJ Broad': 'Stuart Broad',
  'Timothy Southee': 'Tim Southee',
};

const x = (name: string, country: string, role: ExtraPlayer['role'], bat: 'R' | 'L', bowl: string, real: number, s: [number, number, number, number, number]): ExtraPlayer => ({
  name,
  country,
  role,
  bat,
  bowl,
  real,
  skills: { batting: s[0], bowling: s[1], fielding: s[2], fitness: s[3], mental: s[4] },
});

// skills: batting, bowling, fielding, fitness, mental
export const EXTRA_PLAYERS: ExtraPlayer[] = [
  x('Sir Don Bradman', 'Australia', 'BATTER', 'R', 'NONE', 99, [99, 20, 85, 85, 99]),
  x('Sir Garfield Sobers', 'West Indies', 'ALL_ROUNDER', 'L', 'LEFT_ARM_FAST_MEDIUM', 97, [93, 86, 92, 90, 94]),
  x('Viv Richards', 'West Indies', 'BATTER', 'R', 'NONE', 96, [96, 40, 90, 88, 97]),
  x('Sir Clive Lloyd', 'West Indies', 'BATTER', 'L', 'NONE', 90, [89, 30, 90, 82, 94]),
  x('Curtly Ambrose', 'West Indies', 'BOWLER', 'L', 'RIGHT_ARM_FAST', 94, [30, 95, 75, 88, 92]),
  x('Courtney Walsh', 'West Indies', 'BOWLER', 'R', 'RIGHT_ARM_FAST', 91, [15, 92, 70, 94, 90]),
  x('Imran Khan', 'Pakistan', 'ALL_ROUNDER', 'R', 'RIGHT_ARM_FAST', 95, [85, 92, 80, 88, 97]),
  x('Wasim Akram', 'Pakistan', 'BOWLER', 'L', 'LEFT_ARM_FAST', 96, [55, 97, 78, 88, 94]),
  x('Saeed Anwar', 'Pakistan', 'BATTER', 'L', 'NONE', 88, [89, 20, 78, 80, 86]),
  x('Kapil Dev', 'India', 'ALL_ROUNDER', 'R', 'RIGHT_ARM_FAST_MEDIUM', 94, [84, 88, 85, 92, 95]),
  x('Ian Botham', 'England', 'ALL_ROUNDER', 'R', 'RIGHT_ARM_FAST_MEDIUM', 93, [85, 88, 85, 86, 94]),
  x('Bob Willis', 'England', 'BOWLER', 'R', 'RIGHT_ARM_FAST', 86, [20, 88, 70, 82, 86]),
  x('Nasser Hussain', 'England', 'BATTER', 'R', 'NONE', 82, [83, 20, 80, 78, 88]),
  x('Richard Hadlee', 'New Zealand', 'ALL_ROUNDER', 'L', 'RIGHT_ARM_FAST', 95, [72, 96, 78, 88, 94]),
  x('Dennis Lillee', 'Australia', 'BOWLER', 'R', 'RIGHT_ARM_FAST', 94, [25, 95, 72, 86, 95]),
  x('Allan Border', 'Australia', 'BATTER', 'L', 'NONE', 91, [91, 45, 88, 86, 96]),
  x('Steve Waugh', 'Australia', 'BATTER', 'R', 'NONE', 92, [92, 50, 86, 86, 98]),
];

/** Names in `photo-names.json` that point at an EXTRA_PLAYERS entry. */
export const EXTRA_ALIASES: Record<string, string> = {
  'Don Bradman': 'Sir Don Bradman',
  'Garfield Sobers': 'Sir Garfield Sobers',
  'Clive Lloyd': 'Sir Clive Lloyd',
};

/**
 * The ranking value for players whose figures in the data do not tell their
 * story: most of their careers came before 2005 (the data's first season), or
 * their country is outside the data. Same scale as the computed one.
 */
export const REAL_OVERRIDES: Record<string, number> = {
  'BC Lara': 96,
  'Sachin Tendulkar': 97,
  'Inzamam-ul-Haq': 90,
  'Rahul Dravid': 92,
  'Sourav Ganguly': 89,
  'Anil Kumble': 92,
  'Shoaib Akhtar': 90,
  'ST Jayasuriya': 90,
  'SL Malinga': 90,
  'Rohit Sharma': 91,
  'Steve Smith': 91,
  'Rashid Khan': 90,
};

/** Role fixes where the data's role code is not how the player is known. */
export const ROLE_OVERRIDES: Record<string, 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER'> = {
  'Rahul Dravid': 'BATTER',
};
