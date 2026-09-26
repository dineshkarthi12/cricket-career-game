import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { ToastHost } from '@/components/ToastHost';
import { installAutosaveGuards, useGameStore } from '@/store/gameStore';
import Home from './screens/Home';
import SlotPicker from './screens/SlotPicker';
import StartScreen from './screens/StartScreen';
import NewCareer from './screens/NewCareer';
import MatchScreen from './screens/match/MatchScreen';
import MatchesScreen from './screens/Matches';
import CalendarScreen from './screens/calendar/CalendarScreen';
import TrainingScreen from './screens/training/TrainingScreen';
import RehabScreen from './screens/training/RehabScreen';
import CareerPathScreen from './screens/career/CareerPathScreen';
import SelectionScreen from './screens/career/SelectionScreen';
import SeasonReviewScreen from './screens/career/SeasonReviewScreen';
import TournamentScreen from './screens/career/TournamentScreen';
import TrialScreen from './screens/career/TrialScreen';
import IplScreen from './screens/pro/IplScreen';
import InternationalScreen from './screens/pro/InternationalScreen';
import AwardsScreen from './screens/pro/AwardsScreen';
import LegacyScreen from './screens/pro/LegacyScreen';
import CommunityScreen from './screens/pro/CommunityScreen';
import { SettingsScreen, StatsScreen } from './screens/placeholders';

export default function App() {
  const bootstrap = useGameStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    return installAutosaveGuards();
  }, [bootstrap]);

  return (
    <>
    <ToastHost />
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
              <Route path="/training/rehab" element={<RehabScreen />} />
              <Route path="/matches" element={<MatchesScreen />} />
              <Route path="/matches/:matchId" element={<MatchesScreen />} />
              <Route path="/match/:fixtureId" element={<MatchScreen />} />
              <Route path="/selection" element={<SelectionScreen />} />
              <Route path="/trial/:fixtureId" element={<TrialScreen />} />
              <Route path="/season-review" element={<SeasonReviewScreen />} />
              <Route path="/tournaments" element={<TournamentScreen />} />
              <Route path="/tournaments/:tournamentId" element={<TournamentScreen />} />
              <Route path="/auction" element={<IplScreen />} />
              <Route path="/international" element={<InternationalScreen />} />
              <Route path="/legacy" element={<LegacyScreen />} />
              <Route path="/retirement" element={<LegacyScreen />} />
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
    </>
  );
}
