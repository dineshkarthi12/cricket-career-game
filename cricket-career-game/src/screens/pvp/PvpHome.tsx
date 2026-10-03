/**
 * Live PvP home: play buttons and ranked status up top, then the player's XI,
 * collection, featured packs, legends, recent matches, rewards and the
 * connection settings.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Gift, Loader2, PackageOpen, Radio, Server, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { Badge, Card, CardHeader, ProgressBar } from '@/components';
import {
  CATALOG,
  ECONOMY,
  PACKS,
  RANKED,
  auditProfile,
  currentWeekly,
  rankedTier,
  squadRating,
  utcDay,
} from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { ModeBadge } from './PvpShell';
import { Price, ownedCards, primaryButton, secondaryButton } from './ui';

export default function PvpHome() {
  const profile = usePvpStore((s) => s.profile)!;
  const mode = usePvpStore((s) => s.mode);
  const searching = usePvpStore((s) => s.searching);
  const startPractice = usePvpStore((s) => s.startPractice);
  const joinQueue = usePvpStore((s) => s.joinQueue);
  const leaveQueue = usePvpStore((s) => s.leaveQueue);
  const economy = usePvpStore((s) => s.economy);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const online = mode === 'ONLINE';
  const cards = ownedCards(profile.inventory).sort((a, b) => b.overall - a.overall);
  const xi = profile.squad ? profile.squad.xi.map((id) => cards.find((c) => c.owned.instanceId === id)).filter(Boolean) : [];
  const issues = auditProfile(profile);
  const rating = profile.rankedRating;
  const weekly = currentWeekly(profile, new Date().toISOString());
  const dailyDone = profile.daily.lastClaim === utcDay(new Date().toISOString());

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const practice = () =>
    run('practice', async () => {
      const id = await startPractice();
      if (id) navigate('/pvp/match');
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card bg-brand-navy text-white shadow-card">
        <img src="/assets/banner-bg.jpg" alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
        <div className="banner-wash absolute inset-0" aria-hidden />
        <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <ModeBadge className="bg-white/90" />
            <h1 className="mt-3 text-[28px] leading-tight font-extrabold sm:text-[36px]">
              Live PvP <span className="text-brand-gold">Cricket</span>
            </h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/80">
              Bowl, bat and time every ball in a 3D stadium. Two overs a side, three wickets. Your XI of collectible players against theirs.
            </p>
            {!online ? (
              <p className="mt-2 max-w-xl rounded-lg bg-white/10 px-3 py-2 text-[12.5px] text-white/85">
                This is the offline demo: practice matches against the AI on this device. Ranked matches, private rooms and friends need the online server (see Connection below).
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={practice} disabled={!profile.squad || busy !== null} className={primaryButton('bg-brand-gold text-brand-navy hover:bg-brand-gold/90')}>
                {busy === 'practice' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Swords className="size-4" aria-hidden />}
                Practice vs AI
              </button>
              {searching ? (
                <button type="button" onClick={() => void leaveQueue()} className={primaryButton('pvp-glow')}>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Searching… cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run('queue', joinQueue)}
                  disabled={!online || !profile.squad || busy !== null}
                  title={online ? 'Find a ranked opponent' : 'Ranked play needs the online server'}
                  className={primaryButton()}
                >
                  <Radio className="size-4" aria-hidden />
                  Ranked match
                </button>
              )}
              <Link to="/pvp/friends" className={secondaryButton('bg-white/15 text-white hover:bg-white/25')}>
                <Users className="size-4" aria-hidden />
                Private room
              </Link>
            </div>
            {!profile.squad ? <p className="mt-2 text-[12.5px] text-brand-gold">Open your free starter pack below to get an XI.</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 self-end">
            <Stat label="Ranked" value={rating === null ? 'Unranked' : `${rating}`} detail={rating === null ? (online ? 'Play a ranked match' : 'Online only') : rankedTier(rating)} />
            <Stat label="Record" value={`${profile.stats.won}-${profile.stats.lost}${profile.stats.tied ? `-${profile.stats.tied}` : ''}`} detail={`${profile.stats.played} played`} />
            <Stat label="Squad rating" value={profile.squad ? `${squadRating(profile.squad, profile.inventory)}` : '—'} detail={`${profile.inventory.length} players owned`} />
            <Stat label="Collection" value={`${new Set(profile.inventory.map((o) => o.cardId)).size}/${CATALOG.length}`} detail="cards collected" />
          </div>
        </div>
      </section>

      {issues.length ? (
        <Card className="border-brand-red/30">
          <CardHeader title="Collection problems found" subtitle="These cards fail validation and are kept out of matches. Nothing was changed automatically." />
          <ul className="mt-2 list-disc pl-5 text-[12.5px] text-ink-muted">
            {issues.slice(0, 6).map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!profile.starterClaimed ? (
        <Card className="border-brand-gold/50 bg-gradient-to-r from-[#fff8dd] to-surface">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-gold text-brand-navy" aria-hidden>
              <Gift className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-ink">Your free starter pack</p>
              <p className="text-[13px] text-ink-muted">Fourteen free players (rated 45-59): two keepers, five batters, three all-rounders and four bowlers - a full playing XI and a bench.</p>
            </div>
            <button type="button" disabled={busy !== null} onClick={() => run('starter', () => economy('claimStarter'))} className={primaryButton()}>
              <PackageOpen className="size-4" aria-hidden />
              Open starter pack
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Your Dream XI" subtitle={profile.squad ? `Squad rating ${squadRating(profile.squad, profile.inventory)}` : 'No XI yet'} action={{ label: 'Squad builder', to: '/pvp/squad' }} />
          {xi.length ? (
            <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {xi.map((c) => (
                <div key={c!.owned.instanceId} className="snap-start">
                  <PlayerCard3D card={c!.card} upgrades={c!.owned.upgrades} size="sm" still />
                  {profile.squad?.captain === c!.owned.instanceId ? <p className="mt-1 text-center text-[11px] font-bold text-brand-blue">Captain</p> : profile.squad?.viceCaptain === c!.owned.instanceId ? <p className="mt-1 text-center text-[11px] font-semibold text-ink-muted">Vice-captain</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">Open the starter pack to get your first XI.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Events & rewards" />
          <div className="mt-3 flex flex-col gap-3">
            <Reward
              icon={CalendarCheck}
              title="Daily reward"
              detail={dailyDone ? 'Claimed today - back tomorrow' : `${ECONOMY.dailyReward.coins} coins`}
              action={dailyDone ? null : { label: 'Claim', run: () => run('daily', () => economy('claimDaily')) }}
              busy={busy === 'daily'}
            />
            <div>
              <Reward
                icon={Trophy}
                title="Weekly mission: win 3 matches"
                detail={weekly.claimed ? 'Reward claimed this week' : `${ECONOMY.weeklyMission.gems} gems + ${ECONOMY.weeklyMission.eventTokens} event token`}
                action={!weekly.claimed && weekly.wins >= ECONOMY.weeklyMission.winsNeeded ? { label: 'Claim', run: () => run('weekly', () => economy('claimWeekly')) } : null}
                busy={busy === 'weekly'}
              />
              <ProgressBar value={Math.min(100, (weekly.wins / ECONOMY.weeklyMission.winsNeeded) * 100)} tone="green" className="mt-2" label={`${Math.min(weekly.wins, 3)} of 3 wins`} />
            </div>
            <Reward icon={Sparkles} title="Opening Week event" detail={`${profile.eventTokens} event token${profile.eventTokens === 1 ? '' : 's'} - spend in the store`} action={{ label: 'Store', run: () => navigate('/pvp/store') }} />
            <p className="text-[11.5px] text-ink-muted">Match rewards: win {ECONOMY.matchReward.WIN.coins}, tie {ECONOMY.matchReward.TIE.coins}, loss {ECONOMY.matchReward.LOSS.coins} coins. Ranked wins add {ECONOMY.matchReward.rankedWinBonusCoins} coins and {ECONOMY.matchReward.rankedWinGems} gems.</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your collection" subtitle="Hover or drag a card to tilt it" action={{ label: 'View all', to: '/pvp/collection' }} />
        <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-2 pb-3">
          {cards.slice(0, 10).map((c) => (
            <div key={c.owned.instanceId} className="snap-start">
              <PlayerCard3D card={c.card} upgrades={c.owned.upgrades} />
            </div>
          ))}
          {cards.length === 0 ? <p className="text-[13px] text-ink-muted">No players yet.</p> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Featured packs" action={{ label: 'Packs & store', to: '/pvp/store' }} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PACKS.filter((p) => p.featured || p.id === 'silver').slice(0, 4).map((p) => (
              <Link key={p.id} to="/pvp/store" className="flex items-center justify-between gap-2 rounded-tile border border-line bg-page/60 p-3 transition-colors hover:border-brand-blue/40">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{p.slots.length} cards · {p.guarantee ?? 'published odds'}</span>
                </span>
                <Price currency={p.currency} amount={p.price} className="text-[13px]" />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Legends market" subtitle="Fictional retired greats, rated 80-99" action={{ label: 'Market', to: '/pvp/market?tab=legends' }} />
          <div className="no-scrollbar mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATALOG.filter((c) => c.era === 'LEGEND')
              .sort((a, b) => b.overall - a.overall)
              .slice(0, 5)
              .map((c) => (
                <PlayerCard3D key={c.id} card={c} size="sm" owned={profile.inventory.some((o) => o.cardId === c.id)} onClick={() => navigate('/pvp/market?tab=legends')} />
              ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Recent matches" />
          {profile.history.length ? (
            <ul className="mt-2 divide-y divide-line">
              {profile.history.slice(0, 6).map((m) => (
                <li key={m.matchId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <Badge tone={m.outcome === 'WIN' ? 'green' : m.outcome === 'LOSS' ? 'red' : 'grey'} className="text-[11px]">
                    {m.outcome}
                  </Badge>
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="font-semibold text-ink">vs {m.opponent}</span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {m.myScore} v {m.theirScore} · {m.result}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase">{m.mode === 'PRACTICE' ? 'Practice' : m.mode === 'PRIVATE' ? 'Private' : `Ranked ${m.ratingChange !== null ? (m.ratingChange >= 0 ? '+' : '') + m.ratingChange : ''}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">No matches yet. Start with a practice match.</p>
          )}
        </Card>
        <ConnectionCard />
      </div>
      <p className="text-center text-[11px] text-ink-muted">
        All Live PvP players are fictional, with original illustrated portraits. Ratings are gameplay values. Gems are a development currency: no real-money purchases exist. Ranked starts at {RANKED.startRating}.
      </p>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-tile bg-white/10 px-3 py-2.5 backdrop-blur">
      <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
      <p className="text-[20px] leading-tight font-bold">{value}</p>
      <p className="truncate text-[11.5px] text-white/70">{detail}</p>
    </div>
  );
}

function Reward({ icon: Icon, title, detail, action, busy }: { icon: typeof Gift; title: string; detail: string; action: { label: string; run: () => void } | null; busy?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-blue-soft text-brand-blue" aria-hidden>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[12px] text-ink-muted">{detail}</span>
      </span>
      {action ? (
        <button type="button" onClick={action.run} disabled={busy} className="rounded-lg bg-brand-blue px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
          {busy ? '…' : action.label}
        </button>
      ) : null}
    </div>
  );
}

function ConnectionCard() {
  const mode = usePvpStore((s) => s.mode);
  const label = usePvpStore((s) => s.label);
  const serverUrl = usePvpStore((s) => s.serverUrl);
  const useServer = usePvpStore((s) => s.useServer);
  const [url, setUrl] = useState(serverUrl ?? 'ws://localhost:8787');
  return (
    <Card>
      <CardHeader title="Connection" subtitle={label} />
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[12px] font-semibold text-ink-muted" htmlFor="pvp-server-url">
          PvP server address
        </label>
        <div className="flex gap-2">
          <input
            id="pvp-server-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="wss://your-server.example"
            className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[13px] focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
          />
          <button type="button" onClick={() => void useServer(url.trim() || null)} className={primaryButton('px-3 py-2 text-[13px]')}>
            <Server className="size-4" aria-hidden />
            Connect
          </button>
        </div>
        {mode === 'ONLINE' ? (
          <button type="button" onClick={() => void useServer(null)} className={cn(secondaryButton('py-2 text-[13px]'))}>
            Switch to the offline demo
          </button>
        ) : (
          <p className="text-[12px] text-ink-muted">
            Run <code className="rounded bg-page px-1">npm run pvp:server</code> and connect to play real online matches. The offline demo keeps its own local collection.
          </p>
        )}
      </div>
    </Card>
  );
}
