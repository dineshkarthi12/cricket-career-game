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
import { rich, useT } from '@/i18n/react';
import { summaryText } from '@/lib/matchText';
import { backendLabel, packGuarantee, packName, rankLabel } from './labels';
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
  const t = useT();
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
              {t('nav.pvp')} <span className="text-brand-gold">{t('pvp.home.titleCricket')}</span>
            </h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/80">
              {t('pvp.home.intro')}
            </p>
            {!online ? (
              <p className="mt-2 max-w-xl rounded-lg bg-white/10 px-3 py-2 text-[12.5px] text-white/85">
                {t('pvp.home.offlineNote')}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={practice} disabled={!profile.squad || busy !== null} className={primaryButton('bg-brand-gold text-brand-navy hover:bg-brand-gold/90')}>
                {busy === 'practice' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Swords className="size-4" aria-hidden />}
                {t('pvp.home.practice')}
              </button>
              {searching ? (
                <button type="button" onClick={() => void leaveQueue()} className={primaryButton('pvp-glow')}>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('pvp.home.searching')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run('queue', joinQueue)}
                  disabled={!online || !profile.squad || busy !== null}
                  title={t(online ? 'pvp.home.findRanked' : 'pvp.home.rankedNeedsServer')}
                  className={primaryButton()}
                >
                  <Radio className="size-4" aria-hidden />
                  {t('pvp.home.ranked')}
                </button>
              )}
              <Link to="/pvp/friends" className={secondaryButton('bg-white/15 text-white hover:bg-white/25')}>
                <Users className="size-4" aria-hidden />
                {t('pvp.home.privateRoom')}
              </Link>
            </div>
            {!profile.squad ? <p className="mt-2 text-[12.5px] text-brand-gold">{t('pvp.home.openStarterHint')}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 self-end">
            <Stat label={t('pvp.mode.RANKED')} value={rating === null ? t('pvp.unranked') : `${rating}`} detail={rating === null ? t(online ? 'pvp.home.playRanked' : 'pvp.home.onlineOnly') : rankLabel(t, rankedTier(rating))} />
            <Stat label={t('pvp.home.record')} value={`${profile.stats.won}-${profile.stats.lost}${profile.stats.tied ? `-${profile.stats.tied}` : ''}`} detail={t('pvp.home.played', { n: profile.stats.played })} />
            <Stat label={t('pvp.home.squadRating')} value={profile.squad ? `${squadRating(profile.squad, profile.inventory)}` : '—'} detail={t('pvp.home.ownedN', { n: profile.inventory.length })} />
            <Stat label={t('pvp.home.collection')} value={`${new Set(profile.inventory.map((o) => o.cardId)).size}/${CATALOG.length}`} detail={t('pvp.home.collected')} />
          </div>
        </div>
      </section>

      {issues.length ? (
        <Card className="border-brand-red/30">
          <CardHeader title={t('pvp.home.problems')} subtitle={t('pvp.home.problemsSub')} />
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
              <p className="text-[16px] font-bold text-ink">{t('pvp.home.starterTitle')}</p>
              <p className="text-[13px] text-ink-muted">{t('pvp.home.starterBody')}</p>
            </div>
            <button type="button" disabled={busy !== null} onClick={() => run('starter', () => economy('claimStarter'))} className={primaryButton()}>
              <PackageOpen className="size-4" aria-hidden />
              {t('pvp.home.openStarter')}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={t('pvp.home.dreamXi')} subtitle={profile.squad ? t('pvp.home.squadRatingN', { n: squadRating(profile.squad, profile.inventory) }) : t('pvp.home.noXi')} action={{ label: t('pvp.home.squadBuilder'), to: '/pvp/squad' }} />
          {xi.length ? (
            <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {xi.map((c) => (
                <div key={c!.owned.instanceId} className="snap-start">
                  <PlayerCard3D card={c!.card} upgrades={c!.owned.upgrades} size="sm" still />
                  {profile.squad?.captain === c!.owned.instanceId ? <p className="mt-1 text-center text-[11px] font-bold text-brand-blue">{t('pvp.captain')}</p> : profile.squad?.viceCaptain === c!.owned.instanceId ? <p className="mt-1 text-center text-[11px] font-semibold text-ink-muted">{t('pvp.viceCaptain')}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">{t('pvp.home.noXiBody')}</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t('pvp.home.events')} />
          <div className="mt-3 flex flex-col gap-3">
            <Reward
              icon={CalendarCheck}
              title={t('pvp.home.daily')}
              detail={dailyDone ? t('pvp.home.dailyDone') : t('pvp.coinsN', { n: ECONOMY.dailyReward.coins })}
              action={dailyDone ? null : { label: t('pvp.claim'), run: () => run('daily', () => economy('claimDaily')) }}
              busy={busy === 'daily'}
            />
            <div>
              <Reward
                icon={Trophy}
                title={t('pvp.home.weekly')}
                detail={weekly.claimed ? t('pvp.home.weeklyDone') : t('pvp.home.weeklyReward', { gems: ECONOMY.weeklyMission.gems, tokens: ECONOMY.weeklyMission.eventTokens })}
                action={!weekly.claimed && weekly.wins >= ECONOMY.weeklyMission.winsNeeded ? { label: t('pvp.claim'), run: () => run('weekly', () => economy('claimWeekly')) } : null}
                busy={busy === 'weekly'}
              />
              <ProgressBar value={Math.min(100, (weekly.wins / ECONOMY.weeklyMission.winsNeeded) * 100)} tone="green" className="mt-2" label={t('pvp.home.winsOf', { n: Math.min(weekly.wins, 3) })} />
            </div>
            <Reward icon={Sparkles} title={t('pvp.home.event')} detail={t(profile.eventTokens === 1 ? 'pvp.home.tokens.one' : 'pvp.home.tokens.many', { n: profile.eventTokens })} action={{ label: t('pvp.navShort.store'), run: () => navigate('/pvp/store') }} />
            <p className="text-[11.5px] text-ink-muted">{t('pvp.home.rewards', { win: ECONOMY.matchReward.WIN.coins, tie: ECONOMY.matchReward.TIE.coins, loss: ECONOMY.matchReward.LOSS.coins, bonus: ECONOMY.matchReward.rankedWinBonusCoins, gems: ECONOMY.matchReward.rankedWinGems })}</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('pvp.home.yourCollection')} subtitle={t('pvp.home.tilt')} action={{ label: t('pvp.viewAll'), to: '/pvp/collection' }} />
        <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-2 pb-3">
          {cards.slice(0, 10).map((c) => (
            <div key={c.owned.instanceId} className="snap-start">
              <PlayerCard3D card={c.card} upgrades={c.owned.upgrades} />
            </div>
          ))}
          {cards.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pvp.home.noPlayers')}</p> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('pvp.home.featured')} action={{ label: t('pvp.home.packsStore'), to: '/pvp/store' }} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PACKS.filter((p) => p.featured || p.id === 'silver').slice(0, 4).map((p) => (
              <Link key={p.id} to="/pvp/store" className="flex items-center justify-between gap-2 rounded-tile border border-line bg-page/60 p-3 transition-colors hover:border-brand-blue/40">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{packName(t, p)}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{t('pvp.cards.many', { n: p.slots.length })} · {packGuarantee(t, p) ?? t('pvp.home.publishedOdds')}</span>
                </span>
                <Price currency={p.currency} amount={p.price} className="text-[13px]" />
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title={t('pvp.home.legends')} subtitle={t('pvp.home.legendsSub')} action={{ label: t('pvp.home.market'), to: '/pvp/market?tab=legends' }} />
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
          <CardHeader title={t('pvp.home.recent')} />
          {profile.history.length ? (
            <ul className="mt-2 divide-y divide-line">
              {profile.history.slice(0, 6).map((m) => (
                <li key={m.matchId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <Badge tone={m.outcome === 'WIN' ? 'green' : m.outcome === 'LOSS' ? 'red' : 'grey'} className="text-[11px]">
                    {t(`pvp.outcome.${m.outcome}`)}
                  </Badge>
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="font-semibold text-ink">{t('pvp.vs', { name: m.opponent })}</span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {m.myScore} v {m.theirScore} · {summaryText(m.result)}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase">{m.mode === 'PRACTICE' ? t('pvp.mode.PRACTICE') : m.mode === 'PRIVATE' ? t('pvp.mode.PRIVATE') : `${t('pvp.mode.RANKED')} ${m.ratingChange !== null ? (m.ratingChange >= 0 ? '+' : '') + m.ratingChange : ''}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">{t('pvp.home.noMatches')}</p>
          )}
        </Card>
        <ConnectionCard />
      </div>
      <p className="text-center text-[11px] text-ink-muted">
        {t('pvp.home.footer', { n: RANKED.startRating })}
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
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('pvp.conn.title')} subtitle={backendLabel(t, label, mode)} />
      <div className="mt-3 flex flex-col gap-2">
        <label className="text-[12px] font-semibold text-ink-muted" htmlFor="pvp-server-url">
          {t('pvp.conn.address')}
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
            {t('pvp.conn.connect')}
          </button>
        </div>
        {mode === 'ONLINE' ? (
          <button type="button" onClick={() => void useServer(null)} className={cn(secondaryButton('py-2 text-[13px]'))}>
            {t('pvp.conn.switchOffline')}
          </button>
        ) : (
          <p className="text-[12px] text-ink-muted">
            {rich(t('pvp.conn.howTo'), { cmd: <code className="rounded bg-page px-1">npm run pvp:server</code> })}
          </p>
        )}
      </div>
    </Card>
  );
}
