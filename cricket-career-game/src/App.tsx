import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { ToastHost } from '@/components/ToastHost';
import { ScreenLoading } from '@/components/ScreenLoading';
import { installAutosaveGuards, useGameStore } from '@/store/gameStore';
import { useAppSettings } from '@/store/appSettings';
import Home from './screens/Home';
import SlotPicker from './screens/SlotPicker';
import StartScreen from './screens/StartScreen';
const NewCareer = lazy(() => import('./screens/NewCareer'));
const MatchScreen = lazy(() => import('./screens/match/MatchScreen'));
const MatchesScreen = lazy(() => import('./screens/Matches'));
const CalendarScreen = lazy(() => import('./screens/calendar/CalendarScreen'));
const TrainingScreen = lazy(() => import('./screens/training/TrainingScreen'));
const RehabScreen = lazy(() => import('./screens/training/RehabScreen'));
const CareerPathScreen = lazy(() => import('./screens/career/CareerPathScreen'));
const SelectionScreen = lazy(() => import('./screens/career/SelectionScreen'));
const SeasonReviewScreen = lazy(() => import('./screens/career/SeasonReviewScreen'));
const TournamentScreen = lazy(() => import('./screens/career/TournamentScreen'));
const TrialScreen = lazy(() => import('./screens/career/TrialScreen'));
const IplScreen = lazy(() => import('./screens/pro/IplScreen'));
const InternationalScreen = lazy(() => import('./screens/pro/InternationalScreen'));
const AwardsScreen = lazy(() => import('./screens/pro/AwardsScreen'));
const LegacyScreen = lazy(() => import('./screens/pro/LegacyScreen'));
const CommunityScreen = lazy(() => import('./screens/pro/CommunityScreen'));
const SettingsScreen = lazy(() => import('./screens/placeholders').then((m) => ({ default: m.SettingsScreen })));
const StatsScreen = lazy(() => import('./screens/stats/StatsScreen'));

export default function App() {
  const bootstrap = useGameStore((s) => s.bootstrap);
  const careerReduce = useGameStore((s) => s.state?.settings.reduceMotion ?? false);
  const deviceReduce = useAppSettings((s) => s.reduceMotion);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(careerReduce || deviceReduce);
  }, [careerReduce, deviceReduce]);

  useEffect(() => {
    void bootstrap();
    return installAutosaveGuards();
  }, [bootstrap]);

  return (
    <>
    <ToastHost />
    <Suspense fallback={<ScreenLoading />}>
    <Routes>
      {/* Entry screens: no shell, because there is nothing to navigate yet. */}
      <Route path="/start" element={<StartScreen />} />
      <Route path="/slots" element={<SlotPicker />} />
      <Route path="/new" element={<NewCareer />} />

      <Route
        path="*"
        element={
          <AppShell>
            <Suspense fallback={<ScreenLoading />}>
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
            </Suspense>
          </AppShell>
        }
      />
    </Routes>
    </Suspense>
    </>
  );
}
