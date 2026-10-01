import type { Venue } from '@/types';

/**
 * Home grounds for the IPL Manager mode, one per franchise city. Ground
 * names are real; no association logos or branding are used.
 */
const ground = (id: string, name: string, city: string, state: string, capacity: number, pitch: Venue['defaultPitchType'], straight: number, square: number, bat: number, dew: number): Venue => ({
  id,
  name,
  city,
  state,
  country: 'India',
  capacity,
  defaultPitchType: pitch,
  straightBoundary: straight,
  squareBoundary: square,
  batFriendliness: bat,
  floodlights: true,
  dewFactor: dew,
  season: [3, 4, 5],
});

export const IPL_VENUES: Venue[] = [
  ground('mvenue-chennai', 'MA Chidambaram Stadium', 'Chennai', 'Tamil Nadu', 38000, 'DRY', 74, 66, 52, 55),
  ground('mvenue-hyderabad', 'Rajiv Gandhi International Stadium', 'Hyderabad', 'Telangana', 39000, 'FLAT', 72, 65, 59, 45),
  ground('mvenue-mumbai', 'Wankhede Stadium', 'Mumbai', 'Maharashtra', 33000, 'FLAT', 68, 62, 60, 60),
  ground('mvenue-delhi', 'Arun Jaitley Stadium', 'Delhi', 'Delhi', 41000, 'FLAT', 66, 60, 58, 40),
  ground('mvenue-kolkata', 'Eden Gardens', 'Kolkata', 'West Bengal', 66000, 'SPORTING', 72, 66, 56, 50),
  ground('mvenue-bengaluru', 'M Chinnaswamy Stadium', 'Bengaluru', 'Karnataka', 40000, 'FLAT', 64, 58, 61, 35),
  ground('mvenue-jaipur', 'Sawai Mansingh Stadium', 'Jaipur', 'Rajasthan', 30000, 'DRY', 74, 68, 53, 30),
  ground('mvenue-mohali', 'Maharaja Yadavindra Singh Stadium', 'Mohali', 'Punjab', 38000, 'GREEN', 72, 67, 55, 35),
  ground('mvenue-ahmedabad', 'Narendra Modi Stadium', 'Ahmedabad', 'Gujarat', 132000, 'HARD', 76, 70, 56, 40),
  ground('mvenue-lucknow', 'Ekana Cricket Stadium', 'Lucknow', 'Uttar Pradesh', 50000, 'DRY', 76, 70, 52, 45),
];

export const IPL_VENUES_BY_ID: Record<string, Venue> = Object.fromEntries(IPL_VENUES.map((v) => [v.id, v]));

export const IPL_VENUE_BY_CITY: Record<string, Venue> = Object.fromEntries(IPL_VENUES.map((v) => [v.city, v]));
