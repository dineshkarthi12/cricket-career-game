/** Every IPL Manager screen, inside the manager's own shell. */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScreenLoading } from '@/components';
import { ManagerShell } from './ManagerShell';

const Home = lazy(() => import('./ManagerHome'));
const Profile = lazy(() => import('./ProfileScreen'));
const Scouting = lazy(() => import('./ScoutingScreen'));
const Players = lazy(() => import('./PlayersScreen'));
const Trials = lazy(() => import('./TrialsScreen'));
const AuctionPrep = lazy(() => import('./AuctionPrepScreen'));
const Auction = lazy(() => import('./AuctionScreen'));
const Squad = lazy(() => import('./SquadScreen'));
const Xi = lazy(() => import('./XiScreen'));
const Tactics = lazy(() => import('./TacticsScreen'));
const Development = lazy(() => import('./DevelopmentScreen'));
const Match = lazy(() => import('./MatchScreen'));
const MatchReport = lazy(() => import('./MatchScreen').then((m) => ({ default: m.MatchReportScreen })));
const Fixtures = lazy(() => import('./SeasonScreens').then((m) => ({ default: m.FixturesScreen })));
const Table = lazy(() => import('./SeasonScreens').then((m) => ({ default: m.TableScreen })));
const Awards = lazy(() => import('./SeasonScreens').then((m) => ({ default: m.AwardsScreen })));
const SeasonSummary = lazy(() => import('./SeasonScreens').then((m) => ({ default: m.SeasonSummaryScreen })));
const Legacy = lazy(() => import('./SeasonScreens').then((m) => ({ default: m.LegacyScreen })));
const Staff = lazy(() => import('./OfficeScreens').then((m) => ({ default: m.StaffScreen })));
const Contracts = lazy(() => import('./OfficeScreens').then((m) => ({ default: m.ContractsScreen })));
const Finances = lazy(() => import('./OfficeScreens').then((m) => ({ default: m.FinancesScreen })));
const News = lazy(() => import('./OfficeScreens').then((m) => ({ default: m.NewsScreen })));

export default function ManagerRoutes() {
  const { pathname } = useLocation();
  return (
    <ManagerShell>
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<ScreenLoading />}>
          <Routes>
            <Route index element={<Home />} />
            <Route path="profile" element={<Profile />} />
            <Route path="scouting" element={<Scouting />} />
            <Route path="players" element={<Players />} />
            <Route path="trials" element={<Trials />} />
            <Route path="auction-prep" element={<AuctionPrep />} />
            <Route path="auction" element={<Auction />} />
            <Route path="squad" element={<Squad />} />
            <Route path="xi" element={<Xi />} />
            <Route path="tactics" element={<Tactics />} />
            <Route path="development" element={<Development />} />
            <Route path="fixtures" element={<Fixtures />} />
            <Route path="table" element={<Table />} />
            <Route path="match/:fixtureId" element={<Match />} />
            <Route path="match/:fixtureId/report" element={<MatchReport />} />
            <Route path="staff" element={<Staff />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="finances" element={<Finances />} />
            <Route path="news" element={<News />} />
            <Route path="awards" element={<Awards />} />
            <Route path="season-summary" element={<SeasonSummary />} />
            <Route path="legacy" element={<Legacy />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </ManagerShell>
  );
}
