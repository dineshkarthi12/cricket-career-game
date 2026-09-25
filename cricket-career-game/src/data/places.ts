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
  return (stateName && STATES_BY_NAME[stateName]?.region) || 'SOUTH_EAST';
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
