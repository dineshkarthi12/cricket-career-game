import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { installAutosaveGuards, useGameStore } from '@/store/gameStore';
import Home from './screens/Home';
import SlotPicker from './screens/SlotPicker';
import StartScreen from './screens/StartScreen';
import NewCareer from './screens/NewCareer';
import MatchScreen from './screens/match/MatchScreen';
import MatchesScreen from './screens/Matches';
import {
  AuctionScreen,
  AwardsScreen,
  CalendarScreen,
  CareerPathScreen,
  CommunityScreen,
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
    <Routes>
      {/* Entry screens: no shell, because there is nothing to navigate yet. */}
      <Route path="/start" element={<StartScreen />} />
      <Route path="/slots" element={<SlotPicker />} />
      <Route path="/new" element={<NewCareer />} />

      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/career" element={<CareerPathScreen />} />
              <Route path="/calendar" element={<CalendarScreen />} />
              <Route path="/training" element={<TrainingScreen />} />
              <Route path="/matches" element={<MatchesScreen />} />
              <Route path="/matches/:matchId" element={<MatchesScreen />} />
              <Route path="/match/:fixtureId" element={<MatchScreen />} />
              <Route path="/selection" element={<SelectionScreen />} />
              <Route path="/auction" element={<AuctionScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/awards" element={<AwardsScreen />} />
              <Route path="/community" element={<CommunityScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
