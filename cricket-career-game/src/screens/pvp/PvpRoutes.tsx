/** Live PvP routes: its own shell and store, lazy-loaded with the PvP engine. */
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ScreenLoading } from '@/components';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePvpStore } from '@/store/pvpStore';
import { PvpShell } from './PvpShell';
import PvpHome from './PvpHome';

const CollectionScreen = lazy(() => import('./CollectionScreen'));
const MarketScreen = lazy(() => import('./MarketScreen'));
const StoreScreen = lazy(() => import('./StoreScreen'));
const SquadScreen = lazy(() => import('./SquadScreen'));
const RankingsScreen = lazy(() => import('./RankingsScreen'));
const FriendsScreen = lazy(() => import('./FriendsScreen'));
const MatchScreen2D = lazy(() => import('./match/MatchScreen2D'));

export default function PvpRoutes() {
  const init = usePvpStore((s) => s.init);
  const status = usePvpStore((s) => s.status);
  const profile = usePvpStore((s) => s.profile);
  const match = usePvpStore((s) => s.match);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    void init();
  }, [init]);

  // A match found by matchmaking or a room opens the match screen.
  useEffect(() => {
    if (match && !pathname.startsWith('/pvp/match')) navigate('/pvp/match');
  }, [match, pathname, navigate]);

  if (!profile) {
    return (
      <PvpShell>
        {status === 'error' ? <ConnectionError /> : <ScreenLoading />}
      </PvpShell>
    );
  }

  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<ScreenLoading />}>
        <Routes>
          <Route path="match" element={<MatchScreen2D />} />
          <Route
            path="*"
            element={
              <PvpShell>
                <Suspense fallback={<ScreenLoading />}>
                  <Routes>
                    <Route index element={<PvpHome />} />
                    <Route path="collection" element={<CollectionScreen />} />
                    <Route path="market" element={<MarketScreen />} />
                    <Route path="store" element={<StoreScreen />} />
                    <Route path="squad" element={<SquadScreen />} />
                    <Route path="rankings" element={<RankingsScreen />} />
                    <Route path="friends" element={<FriendsScreen />} />
                    <Route path="*" element={<Navigate to="/pvp" replace />} />
                  </Routes>
                </Suspense>
              </PvpShell>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function ConnectionError() {
  const message = usePvpStore((s) => s.message);
  const useServer = usePvpStore((s) => s.useServer);
  const url = usePvpStore((s) => s.serverUrl);
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-card border border-brand-red/25 bg-surface p-5 shadow-card">
      <p className="text-[16px] font-semibold text-ink">Could not reach the PvP server</p>
      <p className="mt-1 text-[13px] text-ink-muted">{message ?? 'The server did not answer.'} {url ? `(${url})` : ''}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void useServer(url)} className="rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white">
          Try again
        </button>
        <button type="button" onClick={() => void useServer(null)} className="rounded-xl bg-brand-blue-soft px-4 py-2 text-[13px] font-semibold text-brand-blue">
          Use the offline demo (practice vs AI)
        </button>
      </div>
    </div>
  );
}
