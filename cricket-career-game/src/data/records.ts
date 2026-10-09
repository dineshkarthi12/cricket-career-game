/**
 * The records the player can chase, and the all-time lists the TV graphics
 * count the player up (`engine/pro/broadcast.ts`). Real holders and figures,
 * as at the end of the 2025 season (this is a personal project: real names
 * are allowed, see CLAUDE.md).
 */
export type RecordKind = 'CAREER_RUNS' | 'CAREER_WICKETS' | 'HIGH_SCORE' | 'BEST_BOWLING' | 'HUNDREDS' | 'MATCHES' | 'SEASON_RUNS' | 'SEASON_WICKETS';

export type RecordBook = 'India Tests' | 'India ODIs' | 'India T20Is' | 'IPL' | 'Ranji Trophy';

export interface RecordDef {
  id: string;
  /** Which book it belongs to. */
  book: RecordBook;
  label: string;
  kind: RecordKind;
  /** Competition ids whose figures count. */
  competitions: string[];
  holder: string;
  /** Runs, wickets, hundreds or matches; best bowling as wickets*1000 - runs. */
  value: number;
  display: string;
}

export const TEST_COMPETITIONS = ['intl-test', 'world-test-championship'];
export const ODI_COMPETITIONS = ['intl-odi', 'odi-world-cup', 'champions-trophy'];
export const T20I_COMPETITIONS = ['intl-t20i', 't20-world-cup'];
const TEST = TEST_COMPETITIONS;
const ODI = ODI_COMPETITIONS;
const T20I = T20I_COMPETITIONS;

export const RECORDS: RecordDef[] = [
  { id: 'test-runs', book: 'India Tests', label: 'Most Test runs for India', kind: 'CAREER_RUNS', competitions: TEST, holder: 'Sachin Tendulkar', value: 15921, display: '15,921' },
  { id: 'test-wkts', book: 'India Tests', label: 'Most Test wickets for India', kind: 'CAREER_WICKETS', competitions: TEST, holder: 'Anil Kumble', value: 619, display: '619' },
  { id: 'test-hs', book: 'India Tests', label: 'Highest Test score for India', kind: 'HIGH_SCORE', competitions: TEST, holder: 'Virender Sehwag', value: 319, display: '319' },
  { id: 'test-bb', book: 'India Tests', label: 'Best Test bowling for India', kind: 'BEST_BOWLING', competitions: TEST, holder: 'Anil Kumble', value: 10 * 1000 - 74, display: '10/74' },
  { id: 'test-100s', book: 'India Tests', label: 'Most Test hundreds for India', kind: 'HUNDREDS', competitions: TEST, holder: 'Sachin Tendulkar', value: 51, display: '51' },
  { id: 'test-caps', book: 'India Tests', label: 'Most Tests for India', kind: 'MATCHES', competitions: TEST, holder: 'Sachin Tendulkar', value: 200, display: '200' },
  { id: 'odi-runs', book: 'India ODIs', label: 'Most ODI runs for India', kind: 'CAREER_RUNS', competitions: ODI, holder: 'Sachin Tendulkar', value: 18426, display: '18,426' },
  { id: 'odi-wkts', book: 'India ODIs', label: 'Most ODI wickets for India', kind: 'CAREER_WICKETS', competitions: ODI, holder: 'Anil Kumble', value: 334, display: '334' },
  { id: 'odi-hs', book: 'India ODIs', label: 'Highest ODI score for India', kind: 'HIGH_SCORE', competitions: ODI, holder: 'Rohit Sharma', value: 264, display: '264' },
  { id: 'odi-bb', book: 'India ODIs', label: 'Best ODI bowling for India', kind: 'BEST_BOWLING', competitions: ODI, holder: 'Stuart Binny', value: 6 * 1000 - 4, display: '6/4' },
  { id: 'odi-100s', book: 'India ODIs', label: 'Most ODI hundreds for India', kind: 'HUNDREDS', competitions: ODI, holder: 'Virat Kohli', value: 51, display: '51' },
  { id: 't20i-runs', book: 'India T20Is', label: 'Most T20I runs for India', kind: 'CAREER_RUNS', competitions: T20I, holder: 'Rohit Sharma', value: 4231, display: '4,231' },
  { id: 't20i-wkts', book: 'India T20Is', label: 'Most T20I wickets for India', kind: 'CAREER_WICKETS', competitions: T20I, holder: 'Arshdeep Singh', value: 100, display: '100' },
  { id: 't20i-hs', book: 'India T20Is', label: 'Highest T20I score for India', kind: 'HIGH_SCORE', competitions: T20I, holder: 'Abhishek Sharma', value: 135, display: '135' },
  { id: 'ipl-runs', book: 'IPL', label: 'Most IPL runs', kind: 'CAREER_RUNS', competitions: ['ipl'], holder: 'Virat Kohli', value: 8661, display: '8,661' },
  { id: 'ipl-wkts', book: 'IPL', label: 'Most IPL wickets', kind: 'CAREER_WICKETS', competitions: ['ipl'], holder: 'Yuzvendra Chahal', value: 221, display: '221' },
  { id: 'ipl-hs', book: 'IPL', label: 'Highest IPL score', kind: 'HIGH_SCORE', competitions: ['ipl'], holder: 'Chris Gayle', value: 175, display: '175*' },
  { id: 'ipl-season', book: 'IPL', label: 'Most runs in an IPL season', kind: 'SEASON_RUNS', competitions: ['ipl'], holder: 'Virat Kohli', value: 973, display: '973' },
  { id: 'ipl-season-w', book: 'IPL', label: 'Most wickets in an IPL season', kind: 'SEASON_WICKETS', competitions: ['ipl'], holder: 'Harshal Patel', value: 32, display: '32' },
  { id: 'ranji-hs', book: 'Ranji Trophy', label: 'Highest Ranji Trophy score', kind: 'HIGH_SCORE', competitions: ['ranji-trophy'], holder: 'B. B. Nimbalkar', value: 443, display: '443*' },
  { id: 'ranji-season', book: 'Ranji Trophy', label: 'Most runs in a Ranji season', kind: 'SEASON_RUNS', competitions: ['ranji-trophy'], holder: 'VVS Laxman', value: 1415, display: '1,415' },
  { id: 'ranji-season-w', book: 'Ranji Trophy', label: 'Most wickets in a Ranji season', kind: 'SEASON_WICKETS', competitions: ['ranji-trophy'], holder: 'Ashutosh Aman', value: 68, display: '68' },
];

export interface LadderEntry {
  name: string;
  value: number;
}

/**
 * The all-time lists the commentators count the player up, best first: pass
 * a name and the graphic says so ("moves past Suresh Raina into 5th").
 */
export const LADDERS: { book: RecordBook; kind: 'CAREER_RUNS' | 'CAREER_WICKETS'; competitions: string[]; list: LadderEntry[] }[] = [
  {
    book: 'IPL',
    kind: 'CAREER_RUNS',
    competitions: ['ipl'],
    list: [
      { name: 'Virat Kohli', value: 8661 },
      { name: 'Rohit Sharma', value: 7046 },
      { name: 'Shikhar Dhawan', value: 6769 },
      { name: 'David Warner', value: 6565 },
      { name: 'Suresh Raina', value: 5528 },
      { name: 'MS Dhoni', value: 5439 },
      { name: 'KL Rahul', value: 5222 },
      { name: 'AB de Villiers', value: 5162 },
      { name: 'Chris Gayle', value: 4965 },
    ],
  },
  {
    book: 'IPL',
    kind: 'CAREER_WICKETS',
    competitions: ['ipl'],
    list: [
      { name: 'Yuzvendra Chahal', value: 221 },
      { name: 'Bhuvneshwar Kumar', value: 198 },
      { name: 'Sunil Narine', value: 192 },
      { name: 'Piyush Chawla', value: 192 },
      { name: 'Ravichandran Ashwin', value: 187 },
      { name: 'Jasprit Bumrah', value: 183 },
      { name: 'Dwayne Bravo', value: 183 },
      { name: 'Amit Mishra', value: 174 },
    ],
  },
  {
    book: 'India Tests',
    kind: 'CAREER_RUNS',
    competitions: TEST,
    list: [
      { name: 'Sachin Tendulkar', value: 15921 },
      { name: 'Rahul Dravid', value: 13265 },
      { name: 'Sunil Gavaskar', value: 10122 },
      { name: 'Virat Kohli', value: 9230 },
      { name: 'VVS Laxman', value: 8781 },
      { name: 'Virender Sehwag', value: 8503 },
      { name: 'Sourav Ganguly', value: 7212 },
    ],
  },
  {
    book: 'India Tests',
    kind: 'CAREER_WICKETS',
    competitions: TEST,
    list: [
      { name: 'Anil Kumble', value: 619 },
      { name: 'Ravichandran Ashwin', value: 537 },
      { name: 'Kapil Dev', value: 434 },
      { name: 'Harbhajan Singh', value: 417 },
      { name: 'Ishant Sharma', value: 311 },
      { name: 'Zaheer Khan', value: 311 },
    ],
  },
  {
    book: 'India ODIs',
    kind: 'CAREER_RUNS',
    competitions: ODI,
    list: [
      { name: 'Sachin Tendulkar', value: 18426 },
      { name: 'Virat Kohli', value: 14181 },
      { name: 'Sourav Ganguly', value: 11221 },
      { name: 'Rohit Sharma', value: 11168 },
      { name: 'Rahul Dravid', value: 10768 },
      { name: 'MS Dhoni', value: 10599 },
    ],
  },
  {
    book: 'India ODIs',
    kind: 'CAREER_WICKETS',
    competitions: ODI,
    list: [
      { name: 'Anil Kumble', value: 334 },
      { name: 'Javagal Srinath', value: 315 },
      { name: 'Ajit Agarkar', value: 288 },
      { name: 'Zaheer Khan', value: 269 },
      { name: 'Harbhajan Singh', value: 265 },
      { name: 'Kapil Dev', value: 253 },
    ],
  },
  {
    book: 'India T20Is',
    kind: 'CAREER_RUNS',
    competitions: T20I,
    list: [
      { name: 'Rohit Sharma', value: 4231 },
      { name: 'Virat Kohli', value: 4188 },
      { name: 'KL Rahul', value: 2265 },
    ],
  },
  {
    book: 'India T20Is',
    kind: 'CAREER_WICKETS',
    competitions: T20I,
    list: [
      { name: 'Arshdeep Singh', value: 100 },
      { name: 'Yuzvendra Chahal', value: 96 },
      { name: 'Bhuvneshwar Kumar', value: 90 },
    ],
  },
];
