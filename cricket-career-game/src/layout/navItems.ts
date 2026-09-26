import {
  BarChart3,
  CalendarDays,
  Dumbbell,
  Gavel,
  Home,
  Route,
  Settings,
  Swords,
  Trophy,
  Users,
  Newspaper,
  Table2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

/** Primary navigation, in the order shown on design/dashboard.png. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Career Path', to: '/career', icon: Route },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Training', to: '/training', icon: Dumbbell },
  { label: 'Matches', to: '/matches', icon: Swords },
  { label: 'Tournaments', to: '/tournaments', icon: Table2 },
  { label: 'Selection / News', to: '/selection', icon: Newspaper },
  { label: 'IPL Auction', to: '/auction', icon: Gavel },
  { label: 'Stats', to: '/stats', icon: BarChart3 },
  { label: 'Awards', to: '/awards', icon: Trophy },
  { label: 'Community', to: '/community', icon: Users },
  { label: 'Settings', to: '/settings', icon: Settings },
];

/** The four routes that get their own slot on the mobile tab bar. */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ['/', '/career', '/calendar', '/training'].includes(item.to),
);

/** Everything else, shown in the mobile "More" sheet. */
export const MOBILE_MORE_ITEMS = NAV_ITEMS.filter(
  (item) => !MOBILE_NAV_ITEMS.some((primary) => primary.to === item.to),
);
