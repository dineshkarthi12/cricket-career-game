/**
 * The records the player can chase. Holders are fictional, like every
 * other name in the game; the figures are plausible for each competition.
 */
export type RecordKind = 'CAREER_RUNS' | 'CAREER_WICKETS' | 'HIGH_SCORE' | 'BEST_BOWLING' | 'HUNDREDS' | 'MATCHES' | 'SEASON_RUNS' | 'SEASON_WICKETS';

export interface RecordDef {
  id: string;
  /** Which book it belongs to. */
  book: 'India Tests' | 'India ODIs' | 'India T20Is' | 'IPL' | 'Ranji Trophy';
  label: string;
  kind: RecordKind;
  /** Competition ids whose figures count. */
  competitions: string[];
  holder: string;
  /** Runs, wickets, hundreds or matches; best bowling as wickets*1000 - runs. */
  value: number;
  display: string;
}

const TEST = ['intl-test', 'world-test-championship'];
const ODI = ['intl-odi', 'odi-world-cup', 'champions-trophy'];
const T20I = ['intl-t20i', 't20-world-cup'];

export const RECORDS: RecordDef[] = [
  { id: 'test-runs', book: 'India Tests', label: 'Most Test runs for India', kind: 'CAREER_RUNS', competitions: TEST, holder: 'Vikram Raghunath', value: 13480, display: '13,480' },
  { id: 'test-wkts', book: 'India Tests', label: 'Most Test wickets for India', kind: 'CAREER_WICKETS', competitions: TEST, holder: 'Senthil Anbarasan', value: 598, display: '598' },
  { id: 'test-hs', book: 'India Tests', label: 'Highest Test score for India', kind: 'HIGH_SCORE', competitions: TEST, holder: 'Karthik Mahadevan', value: 311, display: '311' },
  { id: 'test-bb', book: 'India Tests', label: 'Best Test bowling for India', kind: 'BEST_BOWLING', competitions: TEST, holder: 'Prakash Venugopal', value: 9 * 1000 - 69, display: '9/69' },
  { id: 'test-100s', book: 'India Tests', label: 'Most Test hundreds for India', kind: 'HUNDREDS', competitions: TEST, holder: 'Vikram Raghunath', value: 43, display: '43' },
  { id: 'test-caps', book: 'India Tests', label: 'Most Tests for India', kind: 'MATCHES', competitions: TEST, holder: 'Vikram Raghunath', value: 181, display: '181' },
  { id: 'odi-runs', book: 'India ODIs', label: 'Most ODI runs for India', kind: 'CAREER_RUNS', competitions: ODI, holder: 'Arjun Deshpande', value: 16920, display: '16,920' },
  { id: 'odi-wkts', book: 'India ODIs', label: 'Most ODI wickets for India', kind: 'CAREER_WICKETS', competitions: ODI, holder: 'Mohan Kulkarni', value: 331, display: '331' },
  { id: 'odi-hs', book: 'India ODIs', label: 'Highest ODI score for India', kind: 'HIGH_SCORE', competitions: ODI, holder: 'Nikhil Bhandari', value: 248, display: '248' },
  { id: 'odi-bb', book: 'India ODIs', label: 'Best ODI bowling for India', kind: 'BEST_BOWLING', competitions: ODI, holder: 'Farhan Qureshi', value: 6 * 1000 - 4, display: '6/4' },
  { id: 'odi-100s', book: 'India ODIs', label: 'Most ODI hundreds for India', kind: 'HUNDREDS', competitions: ODI, holder: 'Arjun Deshpande', value: 47, display: '47' },
  { id: 't20i-runs', book: 'India T20Is', label: 'Most T20I runs for India', kind: 'CAREER_RUNS', competitions: T20I, holder: 'Aditya Chauhan', value: 4150, display: '4,150' },
  { id: 't20i-wkts', book: 'India T20Is', label: 'Most T20I wickets for India', kind: 'CAREER_WICKETS', competitions: T20I, holder: 'Imran Siddiqui', value: 112, display: '112' },
  { id: 't20i-hs', book: 'India T20Is', label: 'Highest T20I score for India', kind: 'HIGH_SCORE', competitions: T20I, holder: 'Rahul Menon', value: 126, display: '126*' },
  { id: 'ipl-runs', book: 'IPL', label: 'Most IPL runs', kind: 'CAREER_RUNS', competitions: ['ipl'], holder: 'Sanjay Thakur', value: 8010, display: '8,010' },
  { id: 'ipl-wkts', book: 'IPL', label: 'Most IPL wickets', kind: 'CAREER_WICKETS', competitions: ['ipl'], holder: 'Pradeep Nair', value: 205, display: '205' },
  { id: 'ipl-hs', book: 'IPL', label: 'Highest IPL score', kind: 'HIGH_SCORE', competitions: ['ipl'], holder: 'Liam Whitfield', value: 175, display: '175*' },
  { id: 'ipl-season', book: 'IPL', label: 'Most runs in an IPL season', kind: 'SEASON_RUNS', competitions: ['ipl'], holder: 'Sanjay Thakur', value: 973, display: '973' },
  { id: 'ipl-season-w', book: 'IPL', label: 'Most wickets in an IPL season', kind: 'SEASON_WICKETS', competitions: ['ipl'], holder: 'Deepak Solanki', value: 32, display: '32' },
  { id: 'ranji-hs', book: 'Ranji Trophy', label: 'Highest Ranji Trophy score', kind: 'HIGH_SCORE', competitions: ['ranji-trophy'], holder: 'Ganesh Patwardhan', value: 443, display: '443*' },
  { id: 'ranji-season', book: 'Ranji Trophy', label: 'Most runs in a Ranji season', kind: 'SEASON_RUNS', competitions: ['ranji-trophy'], holder: 'Suresh Iyengar', value: 1415, display: '1,415' },
  { id: 'ranji-season-w', book: 'Ranji Trophy', label: 'Most wickets in a Ranji season', kind: 'SEASON_WICKETS', competitions: ['ranji-trophy'], holder: 'Harish Bhatnagar', value: 68, display: '68' },
];
