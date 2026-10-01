/** The live auction: the player under the hammer, the bidding, rival franchises and every sale. */
import { Gavel, Hand, SkipForward, Zap } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components';
import { MANAGER, autoCompleteAuction, bidProblem, bidUpTo, currentLotPlayer, hammer, nextUserBid, signReplacement, squadOf, holds, auctionPool } from '@/engine/manager';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, DataTable, Estimate, FranchiseCrest, LinkButton, LockedNotice, Money, PageHeader, RoleTag, ToneBadge, nameOf, shortOf, useManager } from './ui';

export default function AuctionScreen() {
  const { state, apply, replace } = useManager();
  const a = state.auction;
  const f = state.franchises[state.franchiseId];

  if (!a) {
    return (
      <div className="pb-4">
        <PageHeader title="Live auction" />
        <EmptyState icon={Gavel} title="The auction has not started" message={state.season.phase === 'AUCTION_PREP' ? 'Finish your preparation, then continue from Home to open the auction.' : 'The auction is held after the retention window each season.'} action={{ label: 'Auction preparation', to: '/manager/auction-prep' }} />
      </div>
    );
  }

  const lot = a.lot;
  const player = currentLotPlayer(state);
  const next = nextUserBid(state);
  const target = player ? state.auctionPlan.targets.find((t) => t.playerId === player.id) : undefined;
  const problem = player && next !== null ? bidProblem(state, f.id, player, next) : null;
  const leading = lot?.leaderId === f.id;
  const mySales = a.sales.filter((s) => s.franchiseId === f.id);
  const short = MANAGER.rules.squadMin - f.squadIds.length;
  const unsold = a.complete ? auctionPool(state).filter((p) => !p.prospect).sort((x, y) => x.basePrice - y.basePrice).slice(0, 30) : [];

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={`IPL Auction ${state.season.year}`} subtitle={`${a.round === 1 ? 'Main round' : 'Accelerated round'} · lot ${Math.min(a.index + 1, a.queue.length)} of ${a.queue.length}`}>
        {!a.complete && holds(state, 'AUCTION') && !state.profile.fullControl ? (
          <Button variant="secondary" onClick={() => replace(autoCompleteAuction(state))}>
            <SkipForward className="size-4" aria-hidden /> Let your assistant finish (bids to your plan)
          </Button>
        ) : null}
      </PageHeader>
      <LockedNotice responsibility="AUCTION" state={state} />

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden" flush>
          {a.complete ? (
            <div className="p-5">
              <p className="text-[18px] font-bold text-ink">The auction is over</p>
              <p className="mt-1 text-[13px] text-ink-muted">You signed {mySales.length} player{mySales.length === 1 ? '' : 's'}. Purse left <Money lakh={f.purse} />.</p>
              {short > 0 ? <p role="alert" className="mt-2 text-[13px] font-semibold text-brand-red">Sign {short} more to reach the minimum squad of {MANAGER.rules.squadMin} before the season.</p> : <LinkButton to="/manager" variant="gold" className="mt-3">Back to Home to continue</LinkButton>}
            </div>
          ) : player && lot ? (
            <div aria-live="polite">
              <div className="bg-brand-navy px-5 py-4 text-white">
                <p className="text-[11px] font-semibold tracking-wide text-brand-gold uppercase">Under the hammer</p>
                <p className="text-[22px] leading-tight font-bold">{player.name}</p>
                <p className="text-[13px] text-white/80">
                  {roleLabel(player.role)} · age {player.age} · {player.nationality}
                  {player.overseas ? ' · overseas' : ''}
                  {player.prospect ? ' · uncapped prospect' : ''}
                </p>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] text-ink-muted">Base price</p>
                  <p className="text-[16px] font-semibold"><Money lakh={player.basePrice} /></p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-muted">Current bid</p>
                  <p className="text-[24px] font-bold text-brand-blue">{lot.leaderId ? <Money lakh={lot.currentBid} /> : 'No bid'}</p>
                  <p className={cn('text-[12.5px] font-semibold', leading ? 'text-brand-green' : 'text-ink-muted')}>
                    {lot.leaderId ? (leading ? 'You lead' : `${shortOf(state, lot.leaderId)} lead`) : 'Waiting for an opening bid'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-muted">Your scouts</p>
                  <p className="text-[14px]">Rating <Estimate report={state.reports[player.id]} /> · Pot. <Estimate report={state.reports[player.id]} field="potential" /></p>
                  <p className="text-[12px] text-ink-muted">Expected <Money lakh={state.reports[player.id]?.estPrice ?? player.basePrice} />{target ? <> · your max <Money lakh={target.maxBid} /></> : null}</p>
                </div>
              </div>
              {holds(state, 'AUCTION') ? (
                <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
                  <Button disabled={leading || Boolean(problem) || next === null} onClick={() => apply(bidUpTo(state, next ?? 0))}>
                    <Hand className="size-4" aria-hidden /> Bid {next !== null ? <Money lakh={next} /> : null}
                  </Button>
                  {target ? (
                    <Button variant="ghost" disabled={leading || Boolean(problem) || (next ?? Infinity) > target.maxBid} onClick={() => apply(bidUpTo(state, target.maxBid))}>
                      <Zap className="size-4" aria-hidden /> Bid to max (<Money lakh={target.maxBid} />)
                    </Button>
                  ) : null}
                  <Button variant={leading ? 'gold' : 'secondary'} onClick={() => apply(hammer(state))}>
                    <Gavel className="size-4" aria-hidden /> {leading ? 'Stop - sold to you' : lot.leaderId ? 'Stop bidding' : 'Skip player'}
                  </Button>
                  {problem && !leading ? <p role="status" className="w-full text-[12.5px] text-brand-red">{problem}</p> : null}
                </div>
              ) : null}
              {lot.bids.length ? (
                <ol className="max-h-40 overflow-y-auto border-t border-line px-5 py-3 text-[12.5px]" aria-label="Bids on this player">
                  {[...lot.bids].reverse().map((b, i) => (
                    <li key={i} className="flex justify-between py-0.5">
                      <span className={b.franchiseId === f.id ? 'font-semibold text-brand-blue' : 'text-ink'}>{shortOf(state, b.franchiseId)}</span>
                      <Money lakh={b.amount} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : (
            <p className="p-5 text-[13px] text-ink-muted">Waiting for the next lot…</p>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader title="Your squad" subtitle={`${f.squadIds.length}/${MANAGER.rules.squadMax} · ${squadOf(state, f.id).filter((p) => p.overseas).length}/${MANAGER.rules.overseasSquadMax} overseas`} className="mb-2" />
            <p className="text-[20px] font-bold"><Money lakh={f.purse} /> <span className="text-[12px] font-normal text-ink-muted">left</span></p>
            <ul className="mt-2 max-h-40 overflow-y-auto text-[12.5px]">
              {mySales.map((s) => (
                <li key={s.playerId} className="flex justify-between py-0.5">
                  <span>{nameOf(state, s.playerId)}</span>
                  <Money lakh={s.price} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Rival purses" className="mb-2" />
            <ul className="grid gap-1 text-[12.5px]">
              {Object.values(state.franchises).filter((x) => !x.isUser).sort((x, y) => y.purse - x.purse).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><FranchiseCrest franchise={x} size={18} /> {x.short}</span>
                  <span className="tabular-nums">{x.squadIds.length} · <Money lakh={x.purse} /></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Auction log" className="mb-2" />
            <ul className="max-h-48 overflow-y-auto text-[12px] text-ink-muted">
              {a.log.slice(0, 40).map((l, i) => <li key={i} className="py-0.5">{l}</li>)}
            </ul>
          </Card>
        </div>
      </div>

      {a.complete && short > 0 ? (
        <Card>
          <CardHeader title="Replacement signings" subtitle="Unsold players at their base price" className="mb-2" />
          <DataTable caption="Unsold players" head={['Player', 'Role', 'Rating', 'Price', '']}>
            {unsold.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Money lakh={Math.max(20, p.basePrice)} /></td>
                <td className="px-2 py-2"><Button className="min-h-9 px-3" onClick={() => apply(signReplacement(state, p.id), `${p.name} signed.`)}>Sign</Button></td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
      {a.complete ? (
        <Card>
          <CardHeader title="All sales" className="mb-2" />
          <DataTable caption="Auction sales" head={['Player', 'Team', 'Price', 'Round']}>
            {a.sales.filter((s) => s.franchiseId).slice(-60).reverse().map((s) => (
              <tr key={s.playerId} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-1.5">{nameOf(state, s.playerId)}</td>
                <td className="px-2 py-1.5">{shortOf(state, s.franchiseId)}</td>
                <td className="px-2 py-1.5"><Money lakh={s.price} /></td>
                <td className="px-2 py-1.5"><ToneBadge tone="grey">{s.round}</ToneBadge></td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
    </div>
  );
}
