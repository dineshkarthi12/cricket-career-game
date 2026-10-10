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
import { useLang, useT } from '@/i18n/react';
import { bowlingStyleLabel, roleLabel } from './labels';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { SectionTitle, ownedCards, primaryButton, secondaryButton } from './ui';

export default function SquadScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const call = usePvpStore((s) => s.call);
  const [draft, setDraft] = useState<SquadSelection | null>(profile.squad);
  const [slot, setSlot] = useState<number | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const t = useT();
  const lang = useLang();
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
        <SectionTitle title={t('pvp.nav.squad')} />
        <Card>
          <p className="text-[13px] text-ink-muted">{t(cards.length ? 'pvp.squad.noXi' : 'pvp.squad.noPlayers')}</p>
          {auto ? (
            <button type="button" className={primaryButton('mt-3')} onClick={() => setDraft(auto)}>
              <Wand2 className="size-4" aria-hidden />
              {t('pvp.squad.pickForMe')}
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
        title={t('pvp.nav.squad')}
        subtitle={t('pvp.squad.subtitle')}
        action={
          <div className="flex gap-2">
            <button type="button" className={secondaryButton('py-2 text-[13px]')} onClick={() => setDraft(autoPickSquad(cards.map((c) => c.owned)))}>
              <Wand2 className="size-4" aria-hidden />
              {t('pvp.squad.auto')}
            </button>
            <button type="button" className={primaryButton('py-2 text-[13px]')} disabled={!dirty || issues.length > 0 || saving} onClick={save}>
              {t(saving ? 'pvp.squad.saving' : dirty ? 'pvp.squad.save' : 'pvp.squad.saved')}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title={t('pvp.squad.xiTitle', { n: squadRating(draft, profile.inventory) })} subtitle={t('pvp.squad.needs', { n: XI_SIZE, b: MIN_BOWLERS })} />
          <ol className="mt-3 flex flex-col gap-1.5">
            {draft.xi.map((id, i) => {
              const c = byId.get(id);
              return (
                <li key={`${id}-${i}`} className={cn('flex items-center gap-2 rounded-tile border px-2 py-1.5', slot === i ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface')}>
                  <span className="w-5 text-center text-[12px] font-bold text-ink-muted">{i + 1}</span>
                  <button type="button" onClick={() => setSlot(slot === i ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={t('pvp.squad.swap', { name: c?.card.name ?? t('pvp.squad.playerLower') })}>
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-[14px] font-extrabold text-white', c && c.card.cls === 'PREMIUM' ? 'bg-gradient-to-br from-amber-400 to-violet-600' : 'bg-brand-navy')}>{c?.overall ?? '?'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{c?.card.name ?? t('pvp.squad.unknown')}</span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {c ? roleLabel(t, c.card.role) : ''}
                        {c && canBowl(c.card) ? ` · ${bowlingStyleLabel(t, lang, c.card.bowlingStyle)}` : ''}
                      </span>
                    </span>
                  </button>
                  <button type="button" title={t('pvp.captain')} onClick={() => setDraft({ ...draft, captain: id, viceCaptain: draft.viceCaptain === id ? draft.captain : draft.viceCaptain })} className={cn('rounded-full p-1.5', draft.captain === id ? 'bg-brand-gold text-brand-navy' : 'text-ink-soft hover:bg-page')} aria-label={t('pvp.squad.makeCaptain')} aria-pressed={draft.captain === id}>
                    <Crown className="size-4" />
                  </button>
                  <button type="button" title={t('pvp.viceCaptain')} onClick={() => setDraft({ ...draft, viceCaptain: id, captain: draft.captain === id ? draft.viceCaptain : draft.captain })} className={cn('rounded-full p-1.5', draft.viceCaptain === id ? 'bg-brand-blue text-white' : 'text-ink-soft hover:bg-page')} aria-label={t('pvp.squad.makeVice')} aria-pressed={draft.viceCaptain === id}>
                    <Shield className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, -1)} className="rounded-full p-1 text-ink-soft hover:bg-page" aria-label={t('pvp.squad.higher')}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded-full p-1 text-ink-soft hover:bg-page" aria-label={t('pvp.squad.lower')}>
                    <ArrowDown className="size-4" />
                  </button>
                  <input
                    type="checkbox"
                    aria-label={t('pvp.squad.compareName', { name: c?.card.name ?? '' })}
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
            <CardHeader title={t('pvp.squad.balance')} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <Balance label={t('pvp.squad.batters')} value={balance.batters} />
              <Balance label={t('pvp.squad.keepers')} value={balance.keepers} bad={balance.keepers < 1} />
              <Balance label={t('pvp.squad.allRounders')} value={balance.allRounders} />
              <Balance label={t('pvp.squad.bowlers')} value={balance.bowlers} />
              <Balance label={t('pvp.squad.bowlingOptions')} value={balance.bowlingOptions} bad={balance.bowlingOptions < MIN_BOWLERS} />
            </div>
            {issues.length ? (
              <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-brand-red" role="alert">
                {issues.map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12.5px] font-semibold text-brand-green">{t('pvp.squad.valid')}</p>
            )}
          </Card>
          <Card>
            <CardHeader title={t('pvp.squad.tactics')} subtitle={t('pvp.squad.tacticsSub')} />
            <p className="mt-2 text-[12.5px] text-ink-muted">{t('pvp.squad.tacticsBody')}</p>
          </Card>
          {compare.length === 2 ? <Compare a={byId.get(compare[0])!} b={byId.get(compare[1])!} /> : <p className="text-[12px] text-ink-muted"><Scale className="mr-1 inline size-3.5" aria-hidden />{t('pvp.squad.tickTwo')}</p>}
        </div>
      </div>

      <Card>
        <CardHeader title={t('pvp.squad.bench', { n: pool.length })} subtitle={slot === null ? t('pvp.squad.benchHint') : t('pvp.squad.replacing', { n: slot + 1 })} />
        <div className="no-scrollbar mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {pool.map((c) => (
            <div key={c.owned.instanceId} className="snap-start">
              <PlayerCard3D card={c.card} upgrades={c.owned.upgrades} size="sm" still onClick={() => (slot === null ? undefined : swapIn(c.owned.instanceId))} className={cn(slot === null && 'opacity-80')} />
            </div>
          ))}
          {pool.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pvp.squad.allIn')}</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Balance({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between rounded-tile px-3 py-2', bad ? 'bg-brand-red/10 text-brand-red' : 'bg-page')}>
      <span className="min-w-0 break-words">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Compare({ a, b }: { a: ReturnType<typeof ownedCards>[number]; b: ReturnType<typeof ownedCards>[number] }) {
  const t = useT();
  const rows = [
    [t('pvp.attr.overall'), a.overall, b.overall],
    [t('pvp.attr.batting'), a.card.batting, b.card.batting],
    [t('pvp.attr.bowling'), a.card.bowling, b.card.bowling],
    [t('pvp.attr.fielding'), a.card.fielding, b.card.fielding],
    [t('pvp.attr.fitness'), a.card.fitness, b.card.fitness],
  ] as const;
  return (
    <Card>
      <CardHeader title={t('pvp.squad.compare')} />
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
        {roleLabel(t, a.card.role)} vs {roleLabel(t, b.card.role)}
      </Badge>
    </Card>
  );
}

