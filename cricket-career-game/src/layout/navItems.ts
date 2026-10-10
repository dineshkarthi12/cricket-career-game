import {
  BarChart3,
  CalendarDays,
  Dumbbell,
  Gavel,
  Crown,
  Globe,
  Landmark,
  Home,
  Route,
  Settings,
  Swords,
  Target,
  UserRoundSearch,
  IdCard,
  Trophy,
  Users,
  Newspaper,
  Radio,
  Table2,
  type LucideIcon,
} from 'lucide-react';

import type { Key } from '@/i18n/core';

export interface NavItem {
  /** English label (tests, and anything outside React); screens show `t(key)`. */
  label: string;
  key: Key;
  to: string;
  icon: LucideIcon;
}

/** Primary navigation, in the order shown on design/dashboard.png. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', key: 'nav.home', to: '/', icon: Home },
  { label: 'Career Path', key: 'nav.career', to: '/career', icon: Route },
  { label: 'Calendar', key: 'nav.calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Training', key: 'nav.training', to: '/training', icon: Dumbbell },
  { label: 'Matches', key: 'nav.matches', to: '/matches', icon: Swords },
  { label: 'Tournaments', key: 'nav.tournaments', to: '/tournaments', icon: Table2 },
  { label: 'Selection / News', key: 'nav.selection', to: '/selection', icon: Newspaper },
  { label: 'IPL Auction', key: 'nav.auction', to: '/auction', icon: Gavel },
  { label: 'IPL Manager', key: 'nav.manager', to: '/manager', icon: Crown },
  { label: 'Live PvP', key: 'nav.pvp', to: '/pvp', icon: Radio },
  { label: 'International', key: 'nav.international', to: '/international', icon: Globe },
  { label: 'Stats', key: 'nav.stats', to: '/stats', icon: BarChart3 },
  { label: 'Rivals', key: 'nav.rivals', to: '/rivals', icon: UserRoundSearch },
  { label: 'Challenges', key: 'nav.challenges', to: '/challenges', icon: Target },
  { label: 'Awards', key: 'nav.awards', to: '/awards', icon: Trophy },
  { label: 'Career Card', key: 'nav.careerCard', to: '/career-card', icon: IdCard },
  { label: 'Legacy', key: 'nav.legacy', to: '/legacy', icon: Landmark },
  { label: 'Community', key: 'nav.community', to: '/community', icon: Users },
  { label: 'Settings', key: 'nav.settings', to: '/settings', icon: Settings },
];

/** The four routes that get their own slot on the mobile tab bar. */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ['/', '/career', '/calendar', '/training'].includes(item.to),
);

/** Everything else, shown in the mobile "More" sheet. */
export const MOBILE_MORE_ITEMS = NAV_ITEMS.filter(
  (item) => !MOBILE_NAV_ITEMS.some((primary) => primary.to === item.to),
);
