import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { installAutosaveGuards, useGameStore } from '@/store/gameStore';
import Home from './screens/Home';
import {
  AuctionScreen,
  AwardsScreen,
  CalendarScreen,
  CareerPathScreen,
  CommunityScreen,
  MatchesScreen,
  SelectionScreen,
  SettingsScreen,
  StatsScreen,
  TrainingScreen,
} from './screens/placeholders';

export default function App() {
  const bootstrap = useGameStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
    return installAutosaveGuards();
  }, [bootstrap]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/career" element={<CareerPathScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/training" element={<TrainingScreen />} />
        <Route path="/matches" element={<MatchesScreen />} />
        <Route path="/selection" element={<SelectionScreen />} />
        <Route path="/auction" element={<AuctionScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/awards" element={<AwardsScreen />} />
        <Route path="/community" element={<CommunityScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
