import { NATIONS_BY_NAME } from './nations';
import type { ClimateRegion } from '@/types';

/**
 * Hometowns. Tamil Nadu's districts come first (the game's home state), then
 * a handful of cricket towns from every other state.
 */
export const TAMIL_NADU_DISTRICTS: string[] = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Tiruchirappalli',
  'Salem',
  'Tirunelveli',
  'Tiruppur',
  'Erode',
  'Vellore',
  'Thoothukudi',
  'Thanjavur',
  'Dindigul',
  'Kanchipuram',
  'Chengalpattu',
  'Tiruvallur',
  'Karur',
  'Namakkal',
  'Cuddalore',
  'Villupuram',
  'Kallakurichi',
  'Kanyakumari',
  'Nilgiris',
  'Sivaganga',
  'Ramanathapuram',
  'Virudhunagar',
  'Pudukkottai',
  'Theni',
  'Krishnagiri',
  'Dharmapuri',
  'Tiruvannamalai',
  'Nagapattinam',
  'Mayiladuthurai',
  'Tiruvarur',
  'Ariyalur',
  'Perambalur',
  'Ranipet',
  'Tirupathur',
  'Tenkasi',
];

export interface StateInfo {
  /** State or union territory. */
  name: string;
  /** Name its cricket teams play under, e.g. "Hyderabad" for Telangana. */
  team: string;
  /** Two-letter monogram for generic crests. */
  monogram: string;
  region: ClimateRegion;
  zone: 'South' | 'North' | 'West' | 'East' | 'Central';
  towns: string[];
  colors: [string, string];
}

export const STATES: StateInfo[] = [
  { name: 'Tamil Nadu', team: 'Tamil Nadu', monogram: 'TN', region: 'SOUTH_EAST', zone: 'South', towns: TAMIL_NADU_DISTRICTS, colors: ['#C0392B', '#F5C518'] },
  { name: 'Karnataka', team: 'Karnataka', monogram: 'KA', region: 'CENTRAL', zone: 'South', towns: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Shivamogga'], colors: ['#1E5EF0', '#F5C518'] },
  { name: 'Kerala', team: 'Kerala', monogram: 'KL', region: 'SOUTH_WEST', zone: 'South', towns: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Alappuzha'], colors: ['#22A45D', '#F5C518'] },
  { name: 'Andhra Pradesh', team: 'Andhra', monogram: 'AP', region: 'SOUTH_EAST', zone: 'South', towns: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'], colors: ['#C79400', '#0F1B33'] },
  { name: 'Telangana', team: 'Hyderabad', monogram: 'HY', region: 'CENTRAL', zone: 'South', towns: ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad'], colors: ['#7A2E8E', '#F5C518'] },
  { name: 'Goa', team: 'Goa', monogram: 'GO', region: 'SOUTH_WEST', zone: 'South', towns: ['Panaji', 'Margao', 'Vasco da Gama'], colors: ['#0E9AA7', '#FFFFFF'] },
  { name: 'Puducherry', team: 'Puducherry', monogram: 'PY', region: 'SOUTH_EAST', zone: 'South', towns: ['Puducherry', 'Karaikal'], colors: ['#E67E22', '#0F1B33'] },
  { name: 'Maharashtra', team: 'Maharashtra', monogram: 'MH', region: 'WEST', zone: 'West', towns: ['Pune', 'Nagpur', 'Nashik', 'Kolhapur', 'Aurangabad', 'Mumbai'], colors: ['#F59E0B', '#0F1B33'] },
  { name: 'Gujarat', team: 'Gujarat', monogram: 'GJ', region: 'WEST', zone: 'West', towns: ['Ahmedabad', 'Vadodara', 'Surat', 'Rajkot'], colors: ['#E5484D', '#FFFFFF'] },
  { name: 'Rajasthan', team: 'Rajasthan', monogram: 'RJ', region: 'NORTH', zone: 'Central', towns: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'], colors: ['#D35400', '#F5C518'] },
  { name: 'Madhya Pradesh', team: 'Madhya Pradesh', monogram: 'MP', region: 'CENTRAL', zone: 'Central', towns: ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur'], colors: ['#16A085', '#F5C518'] },
  { name: 'Uttar Pradesh', team: 'Uttar Pradesh', monogram: 'UP', region: 'NORTH', zone: 'Central', towns: ['Lucknow', 'Kanpur', 'Meerut', 'Varanasi', 'Prayagraj'], colors: ['#27AE60', '#0F1B33'] },
  { name: 'Delhi', team: 'Delhi', monogram: 'DL', region: 'NORTH', zone: 'North', towns: ['New Delhi', 'Dwarka', 'Rohini'], colors: ['#1B2A6B', '#E5484D'] },
  { name: 'Punjab', team: 'Punjab', monogram: 'PB', region: 'NORTH', zone: 'North', towns: ['Mohali', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'], colors: ['#E5484D', '#F5C518'] },
  { name: 'Haryana', team: 'Haryana', monogram: 'HR', region: 'NORTH', zone: 'North', towns: ['Rohtak', 'Gurugram', 'Faridabad', 'Panipat'], colors: ['#2C3E50', '#F5C518'] },
  { name: 'Himachal Pradesh', team: 'Himachal Pradesh', monogram: 'HP', region: 'NORTH', zone: 'North', towns: ['Dharamsala', 'Shimla', 'Mandi'], colors: ['#8E44AD', '#FFFFFF'] },
  { name: 'Jammu and Kashmir', team: 'Jammu & Kashmir', monogram: 'JK', region: 'NORTH', zone: 'North', towns: ['Jammu', 'Srinagar'], colors: ['#2980B9', '#FFFFFF'] },
  { name: 'West Bengal', team: 'Bengal', monogram: 'BE', region: 'EAST', zone: 'East', towns: ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'], colors: ['#1E5EF0', '#E5484D'] },
  { name: 'Odisha', team: 'Odisha', monogram: 'OD', region: 'EAST', zone: 'East', towns: ['Cuttack', 'Bhubaneswar', 'Rourkela'], colors: ['#E67E22', '#FFFFFF'] },
  { name: 'Jharkhand', team: 'Jharkhand', monogram: 'JH', region: 'EAST', zone: 'East', towns: ['Ranchi', 'Jamshedpur', 'Dhanbad'], colors: ['#1ABC9C', '#0F1B33'] },
  { name: 'Assam', team: 'Assam', monogram: 'AS', region: 'EAST', zone: 'East', towns: ['Guwahati', 'Dibrugarh', 'Jorhat'], colors: ['#27AE60', '#E5484D'] },
  { name: 'Bihar', team: 'Bihar', monogram: 'BR', region: 'EAST', zone: 'East', towns: ['Patna', 'Gaya', 'Bhagalpur'], colors: ['#C0392B', '#FFFFFF'] },
  { name: 'Chhattisgarh', team: 'Chhattisgarh', monogram: 'CG', region: 'CENTRAL', zone: 'Central', towns: ['Raipur', 'Bilaspur', 'Bhilai'], colors: ['#2E86C1', '#F5C518'] },
  { name: 'Uttarakhand', team: 'Uttarakhand', monogram: 'UK', region: 'NORTH', zone: 'Central', towns: ['Dehradun', 'Haridwar', 'Haldwani'], colors: ['#117A65', '#FFFFFF'] },
];

/**
 * Cricket associations that field teams but are not the player's home state:
 * the extra sides in the national competitions (Mumbai, Vidarbha, Saurashtra,
 * the services, the north-east...). Names are real places; every player in
 * them is fictional.
 */
export interface Association {
  team: string;
  monogram: string;
  /** State whose climate and name pool the side uses. */
  state: string;
  zone: StateInfo['zone'];
  city: string;
  colors: [string, string];
}

export const EXTRA_ASSOCIATIONS: Association[] = [
  { team: 'Mumbai', monogram: 'MU', state: 'Maharashtra', zone: 'West', city: 'Mumbai', colors: ['#1B4F9C', '#F5C518'] },
  { team: 'Vidarbha', monogram: 'VI', state: 'Maharashtra', zone: 'Central', city: 'Nagpur', colors: ['#6C3483', '#FFFFFF'] },
  { team: 'Saurashtra', monogram: 'SA', state: 'Gujarat', zone: 'West', city: 'Rajkot', colors: ['#B03A2E', '#F5C518'] },
  { team: 'Baroda', monogram: 'BA', state: 'Gujarat', zone: 'West', city: 'Vadodara', colors: ['#1F618D', '#FFFFFF'] },
  { team: 'Railways', monogram: 'RL', state: 'Delhi', zone: 'Central', city: 'New Delhi', colors: ['#922B21', '#F5C518'] },
  { team: 'Services', monogram: 'SE', state: 'Delhi', zone: 'North', city: 'New Delhi', colors: ['#1C2833', '#E5484D'] },
  { team: 'Tripura', monogram: 'TR', state: 'Assam', zone: 'East', city: 'Agartala', colors: ['#148F77', '#FFFFFF'] },
  { team: 'Meghalaya', monogram: 'ME', state: 'Assam', zone: 'East', city: 'Shillong', colors: ['#2874A6', '#F5C518'] },
  { team: 'Manipur', monogram: 'MN', state: 'Assam', zone: 'East', city: 'Imphal', colors: ['#A93226', '#FFFFFF'] },
  { team: 'Nagaland', monogram: 'NA', state: 'Assam', zone: 'East', city: 'Dimapur', colors: ['#212F3D', '#F59E0B'] },
  { team: 'Mizoram', monogram: 'MZ', state: 'Assam', zone: 'East', city: 'Aizawl', colors: ['#117864', '#F5C518'] },
  { team: 'Sikkim', monogram: 'SK', state: 'West Bengal', zone: 'East', city: 'Gangtok', colors: ['#5B2C6F', '#FFFFFF'] },
  { team: 'Arunachal Pradesh', monogram: 'AR', state: 'Assam', zone: 'East', city: 'Itanagar', colors: ['#D35400', '#0F1B33'] },
  { team: 'Chandigarh', monogram: 'CH', state: 'Punjab', zone: 'North', city: 'Chandigarh', colors: ['#2E4053', '#F5C518'] },
];

/** One side in the national competitions: a state or an extra association. */
export interface CricketSide {
  team: string;
  monogram: string;
  state: string;
  zone: StateInfo['zone'];
  city: string;
  colors: [string, string];
}

/** Every state and association side in the country, home states first. */
export const ALL_SIDES: CricketSide[] = [
  ...STATES.map((s) => ({ team: s.team, monogram: s.monogram, state: s.name, zone: s.zone, city: s.towns[0], colors: s.colors })),
  ...EXTRA_ASSOCIATIONS,
];

/** National U-19 sides for India U-19 cricket. */
export const U19_NATIONS = [
  'Australia',
  'England',
  'South Africa',
  'New Zealand',
  'Pakistan',
  'Sri Lanka',
  'West Indies',
  'Bangladesh',
  'Afghanistan',
  'Ireland',
  'Zimbabwe',
  'Scotland',
  'Nepal',
  'United Arab Emirates',
  'United States',
];

export const STATES_BY_NAME: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((state) => [state.name, state]),
);

/** The state a town belongs to, or Tamil Nadu when it is not one we know. */
export function stateOfTown(town: string): StateInfo {
  return STATES.find((state) => state.towns.includes(town)) ?? STATES[0];
}

export function stateInfo(name: string): StateInfo {
  return STATES_BY_NAME[name] ?? STATES[0];
}

/** Climate zone for a state name; overseas venues count as the home region. */
export function regionOf(stateName: string | undefined): ClimateRegion {
  return (stateName && (STATES_BY_NAME[stateName]?.region ?? NATIONS_BY_NAME[stateName]?.region)) || 'SOUTH_EAST';
}

/** A venue's climate: its state's, or its country's overseas; undefined when unknown. */
export function climateOfVenue(venue: { state: string; country: string } | undefined | null): ClimateRegion | undefined {
  if (!venue) return undefined;
  if (venue.country && venue.country !== 'India') return NATIONS_BY_NAME[venue.country]?.region;
  return STATES_BY_NAME[venue.state]?.region;
}

/** Fictional school and club names for the beginner stage. */
export const SCHOOL_NAMES = [
  'St. Aloysius School',
  'Vidya Mandir',
  'Bharathi Vidyalaya',
  'Sri Ram Academy',
  'Holy Cross School',
  'Green Park School',
  'Lakshmi Public School',
  'Don Bosco High',
  'Kendriya Vidyalaya',
  'Sacred Heart School',
];

export const CLUB_NAMES = [
  'Riverside CC',
  'Young Stars CC',
  'Sporting Union',
  'Crescent CC',
  'Nelson CC',
  'United Colts',
  'Parkside CC',
  'Evergreen CC',
];

/** Fictional franchises. No real IPL team names. */
export const FRANCHISE_NAMES: { name: string; short: string; monogram: string; colors: [string, string] }[] = [
  { name: 'Coromandel Kings', short: 'Coromandel', monogram: 'CK', colors: ['#F5C518', '#1E5EF0'] },
  { name: 'Deccan Thunder', short: 'Thunder', monogram: 'DT', colors: ['#F59E0B', '#0F1B33'] },
  { name: 'Gateway Giants', short: 'Giants', monogram: 'GG', colors: ['#1E5EF0', '#F5C518'] },
  { name: 'Capital Comets', short: 'Comets', monogram: 'CC', colors: ['#E5484D', '#1B2A6B'] },
  { name: 'Hooghly Hawks', short: 'Hawks', monogram: 'HH', colors: ['#6C3483', '#F5C518'] },
  { name: 'Garden City Gladiators', short: 'Gladiators', monogram: 'GC', colors: ['#C0392B', '#0F1B33'] },
  { name: 'Thar Titans', short: 'Titans', monogram: 'TT', colors: ['#E91E63', '#1E5EF0'] },
  { name: 'Five Rivers Falcons', short: 'Falcons', monogram: 'FR', colors: ['#E5484D', '#C0C0C0'] },
  { name: 'Sabarmati Strikers', short: 'Strikers', monogram: 'SS', colors: ['#154360', '#F5C518'] },
  { name: 'Awadh Arrows', short: 'Arrows', monogram: 'AA', colors: ['#16A085', '#F59E0B'] },
];

export const TEST_NATIONS = [
  'Australia',
  'England',
  'South Africa',
  'New Zealand',
  'Pakistan',
  'Sri Lanka',
  'West Indies',
  'Bangladesh',
  'Afghanistan',
];
