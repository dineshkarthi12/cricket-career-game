/**
 * Squad Builder: the XI in batting order, captain and vice-captain, the
 * bench, role balance and squad rating, with the same validation the
 * authority applies before a match. Tap a slot, then a player, to swap.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Crown, Scale, Shield, Wand2 } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components';
import {
  MIN_BOWLERS,
  ROLE_LABEL,
  XI_SIZE,
  autoPickSquad,
  canBowl,
  quarantinedInstances,
  roleBalance,
  squadRating,
  validateSquad,
  type SquadSelection,
} from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { SectionTitle, ownedCards, primaryButton, secondaryButton } from './ui';

export default function SquadScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const call = usePvpStore((s) => s.call);
  const [draft, setDraft] = useState<SquadSelection | null>(profile.squad);
  const [slot, setSlot] = useState<number | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const bad = useMemo(() => quarantinedInstances(profile), [profile]);
  const cards = useMemo(() => ownedCards(profile.inventory).filter((c) => !bad.has(c.owned.instanceId)), [profile.inventory, bad]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.owned.instanceId, c])), [cards]);

  useEffect(() => {
    setDraft(profile.squad);
  }, [profile.squad]);

  if (!draft) {
    const auto = autoPickSquad(cards.map((c) => c.owned));
    return (
      <div className="flex flex-col gap-4">
        <SectionTitle title="Squad Builder" />
        <Card>
          <p className="text-[13px] text-ink-muted">{cards.length ? 'You have no XI yet.' : 'You have no players yet - open the starter pack on the Live PvP home.'}</p>
          {auto ? (
            <button type="button" className={primaryButton('mt-3')} onClick={() => setDraft(auto)}>
              <Wand2 className="size-4" aria-hidden />
              Pick an XI for me
            </button>
          ) : null}
        </Card>
      </div>
    );
  }

  const issues = validateSquad(draft, profile.inventory);
  const xiCards = draft.xi.map((id) => byId.get(id)).filter(Boolean) as ReturnType<typeof ownedCards>;
  const balance = roleBalance(xiCards.map((c) => c.card));
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile.squad);
  const pool = cards.filter((c) => !draft.xi.includes(c.owned.instanceId)).sort((a, b) => b.overall - a.overall);

  const swapIn = (instanceId: string) => {
    if (slot === null) return;
    const xi = [...draft.xi];
    const out = xi[slot];
    xi[slot] = instanceId;
    setDraft({
      ...draft,
      xi,
      bench: [...draft.bench.filter((b) => b !== instanceId), out].filter((b) => !xi.includes(b)),
      captain: draft.captain === out ? instanceId : draft.captain,
      viceCaptain: draft.viceCaptain === out ? instanceId : draft.viceCaptain,
    });
    setSlot(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.xi.length) return;
    const xi = [...draft.xi];
    [xi[i], xi[j]] = [xi[j], xi[i]];
    setDraft({ ...draft, xi });
  };
  const save = async () => {
    setSaving(true);
    await call('saveSquad', { squad: draft });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        title="Squad Builder"
        subtitle="Batting order top to bottom. Tap a player to swap them for someone from your collection."
        action={
          <div className="flex gap-2">
            <button type="button" className={secondaryButton('py-2 text-[13px]')} onClick={() => setDraft(autoPickSquad(cards.map((c) => c.owned)))}>
              <Wand2 className="size-4" aria-hidden />
              Auto-pick
            </button>
            <button type="button" className={primaryButton('py-2 text-[13px]')} disabled={!dirty || issues.length > 0 || saving} onClick={save}>
              {saving ? 'Saving…' : dirty ? 'Save XI' : 'Saved'}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={`Playing XI · rating ${squadRating(draft, profile.inventory)}`} subtitle={`Needs ${XI_SIZE} players, a wicketkeeper and at least ${MIN_BOWLERS} bowling options.`} />
          <ol className="mt-3 flex flex-col gap-1.5">
            {draft.xi.map((id, i) => {
              const c = byId.get(id);
              return (
                <li key={`${id}-${i}`} className={cn('flex items-center gap-2 rounded-tile border px-2 py-1.5', slot === i ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface')}>
                  <span className="w-5 text-center text-[12px] font-bold text-ink-muted">{i + 1}</span>
                  <button type="button" onClick={() => setSlot(slot === i ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Swap ${c?.card.name ?? 'player'}`}>
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-[14px] font-extrabold text-white', c && c.card.cls === 'PREMIUM' ? 'bg-gradient-to-br from-amber-400 to-violet-600' : 'bg-brand-navy')}>{c?.overall ?? '?'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{c?.card.name ?? 'Unknown player'}</span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {c ? ROLE_LABEL[c.card.role] : ''}
                        {c && canBowl(c.card) ? ` · ${c.card.bowlingStyle.replaceAll('_', ' ').toLowerCase()}` : ''}
                      </span>
                    </span>
                  </button>
                  <button type="button" title="Captain" onClick={() => setDraft({ ...draft, captain: id, viceCaptain: draft.viceCaptain === id ? draft.captain : draft.viceCaptain })} className={cn('rounded-full p-1.5', draft.captain === id ? 'bg-brand-gold text-brand-navy' : 'text-ink-soft hover:bg-page')} aria-label="Make captain" aria-pressed={draft.captain === id}>
                    <Crown className="size-4" />
                  </button>
                  <button type="button" title="Vice-captain" onClick={() => setDraft({ ...draft, viceCaptain: id, captain: draft.captain === id ? draft.viceCaptain : draft.captain })} className={cn('rounded-full p-1.5', draft.viceCaptain === id ? 'bg-brand-blue text-white' : 'text-ink-soft hover:bg-page')} aria-label="Make vice-captain" aria-pressed={draft.viceCaptain === id}>
                    <Shield className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, -1)} className="rounded-full p-1 text-ink-soft hover:bg-page" aria-label="Bat higher">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded-full p-1 text-ink-soft hover:bg-page" aria-label="Bat lower">
                    <ArrowDown className="size-4" />
                  </button>
                  <input
                    type="checkbox"
                    aria-label={`Compare ${c?.card.name}`}
                    checked={compare.includes(id)}
                    onChange={(e) => setCompare(e.target.checked ? [...compare, id].slice(-2) : compare.filter((x) => x !== id))}
                    className="size-4 accent-brand-blue"
                  />
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Role balance" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <Balance label="Batters" value={balance.batters} />
              <Balance label="Wicketkeepers" value={balance.keepers} bad={balance.keepers < 1} />
              <Balance label="All-rounders" value={balance.allRounders} />
              <Balance label="Bowlers" value={balance.bowlers} />
              <Balance label="Bowling options" value={balance.bowlingOptions} bad={balance.bowlingOptions < MIN_BOWLERS} />
            </div>
            {issues.length ? (
              <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-brand-red" role="alert">
                {issues.map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12.5px] font-semibold text-brand-green">This XI is valid for ranked, private and practice matches.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Formation & tactics" subtitle="In the quick format the field is set automatically for each phase (powerplay, middle, death) and bowler type." />
            <p className="mt-2 text-[12.5px] text-ink-muted">You choose the bowler for each over and every delivery's type, line and length during the match. Captain and vice-captain are shown to your opponent.</p>
          </Card>
          {compare.length === 2 ? <Compare a={byId.get(compare[0])!} b={byId.get(compare[1])!} /> : <p className="text-[12px] text-ink-muted"><Scale className="mr-1 inline size-3.5" aria-hidden />Tick two players to compare them.</p>}
        </div>
      </div>

      <Card>
        <CardHeader title={`Bench & collection (${pool.length})`} subtitle={slot === null ? 'Tap a player in the XI first, then pick their replacement here.' : `Replacing #${slot + 1} - pick a player`} />
        <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {pool.map((c) => (
            <div key={c.owned.instanceId} className="snap-start">
              <PlayerCard3D card={c.card} upgrades={c.owned.upgrades} size="sm" still onClick={() => (slot === null ? undefined : swapIn(c.owned.instanceId))} className={cn(slot === null && 'opacity-80')} />
            </div>
          ))}
          {pool.length === 0 ? <p className="text-[13px] text-ink-muted">Everyone you own is in the XI. Get more players from packs or the market.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Balance({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between rounded-tile px-3 py-2', bad ? 'bg-brand-red/10 text-brand-red' : 'bg-page')}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Compare({ a, b }: { a: ReturnType<typeof ownedCards>[number]; b: ReturnType<typeof ownedCards>[number] }) {
  const rows = [
    ['Overall', a.overall, b.overall],
    ['Batting', a.card.batting, b.card.batting],
    ['Bowling', a.card.bowling, b.card.bowling],
    ['Fielding', a.card.fielding, b.card.fielding],
    ['Fitness', a.card.fitness, b.card.fitness],
  ] as const;
  return (
    <Card>
      <CardHeader title="Compare" />
      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="text-[11.5px] text-ink-muted">
            <th />
            <th className="truncate text-right">{a.card.name}</th>
            <th className="truncate text-right">{b.card.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, x, y]) => (
            <tr key={k} className="border-t border-line">
              <td className="py-1">{k}</td>
              <td className={cn('py-1 text-right', x > y && 'font-bold text-brand-green')}>{x}</td>
              <td className={cn('py-1 text-right', y > x && 'font-bold text-brand-green')}>{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Badge tone="grey" className="mt-2 text-[11px]">
        {ROLE_LABEL[a.card.role]} vs {ROLE_LABEL[b.card.role]}
      </Badge>
    </Card>
  );
}

