/** The live auction: the player under the hammer, the bidding, rival franchises and every sale. */
import { Gavel, Hand, SkipForward, Zap } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components';
import { MANAGER, autoCompleteAuction, bidProblem, bidUpTo, currentLotPlayer, hammer, nextUserBid, signReplacement, squadOf, holds, auctionPool } from '@/engine/manager';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import { rich, useT } from '@/i18n/react';
import { Button, DataTable, Estimate, FranchiseCrest, LinkButton, LockedNotice, Money, PageHeader, RoleTag, ToneBadge, nameOf, shortOf, useManager } from './ui';

export default function AuctionScreen() {
  const t = useT();
  const { state, apply, replace } = useManager();
  const a = state.auction;
  const f = state.franchises[state.franchiseId];

  if (!a) {
    return (
      <div className="pb-4">
        <PageHeader title={t('mgr.auc.live')} />
        <EmptyState icon={Gavel} title={t('mgr.auc.notStarted')} message={state.season.phase === 'AUCTION_PREP' ? t('mgr.auc.finishPrep') : t('mgr.auc.afterRetention')} action={{ label: t('mgr.phase.AUCTION_PREP'), to: '/manager/auction-prep' }} />
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
      <PageHeader title={t('mgr.auc.title', { year: state.season.year })} subtitle={`${a.round === 1 ? t('mgr.auc.mainRound') : t('mgr.auc.accelRound')} · ${t('mgr.auc.lotOf', { n: Math.min(a.index + 1, a.queue.length), of: a.queue.length })}`}>
        {!a.complete && holds(state, 'AUCTION') && !state.profile.fullControl ? (
          <Button variant="secondary" onClick={() => replace(autoCompleteAuction(state))}>
            <SkipForward className="size-4" aria-hidden /> {t('mgr.auc.assistant')}
          </Button>
        ) : null}
      </PageHeader>
      <LockedNotice responsibility="AUCTION" state={state} />

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden" flush>
          {a.complete ? (
            <div className="p-5">
              <p className="text-[18px] font-bold text-ink">{t('mgr.auc.over')}</p>
              <p className="mt-1 text-[13px] text-ink-muted">{rich(t(mySales.length === 1 ? 'mgr.auc.signed.one' : 'mgr.auc.signed.many', { n: mySales.length }), { purse: <Money lakh={f.purse} /> })}</p>
              {short > 0 ? <p role="alert" className="mt-2 text-[13px] font-semibold text-brand-red">{t('mgr.auc.signMore', { n: short, min: MANAGER.rules.squadMin })}</p> : <LinkButton to="/manager" variant="gold" className="mt-3">{t('mgr.auc.backHome')}</LinkButton>}
            </div>
          ) : player && lot ? (
            <div aria-live="polite">
              <div className="bg-brand-navy px-5 py-4 text-white">
                <p className="text-[11px] font-semibold tracking-wide text-brand-gold uppercase">{t('mgr.auc.hammer')}</p>
                <p className="text-[22px] leading-tight font-bold">{player.name}</p>
                <p className="text-[13px] text-white/80">
                  {roleLabel(player.role)} · {t('mgr.ageN', { n: player.age })} · {player.nationality}
                  {player.overseas ? ` · ${t('mgr.auc.overseas')}` : ''}
                  {player.prospect ? ` · ${t('mgr.auc.uncapped')}` : ''}
                </p>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] text-ink-muted">{t('mgr.auc.basePrice')}</p>
                  <p className="text-[16px] font-semibold"><Money lakh={player.basePrice} /></p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-muted">{t('mgr.auc.currentBid')}</p>
                  <p className="text-[24px] font-bold text-brand-blue">{lot.leaderId ? <Money lakh={lot.currentBid} /> : t('mgr.auc.noBid')}</p>
                  <p className={cn('text-[12.5px] font-semibold', leading ? 'text-brand-green' : 'text-ink-muted')}>
                    {lot.leaderId ? (leading ? t('mgr.auc.youLead') : t('mgr.auc.theyLead', { team: shortOf(state, lot.leaderId) })) : t('mgr.auc.waitingOpen')}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-muted">{t('mgr.auc.yourScouts')}</p>
                  <p className="text-[14px]">{t('mgr.col.rating')} <Estimate report={state.reports[player.id]} /> · {t('mgr.potShort')} <Estimate report={state.reports[player.id]} field="potential" /></p>
                  <p className="text-[12px] text-ink-muted">{t('mgr.col.expected')} <Money lakh={state.reports[player.id]?.estPrice ?? player.basePrice} />{target ? <> · {t('mgr.auc.yourMax')} <Money lakh={target.maxBid} /></> : null}</p>
                </div>
              </div>
              {holds(state, 'AUCTION') ? (
                <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
                  <Button disabled={leading || Boolean(problem) || next === null} onClick={() => apply(bidUpTo(state, next ?? 0))}>
                    <Hand className="size-4" aria-hidden /> {t('mgr.auc.bid')} {next !== null ? <Money lakh={next} /> : null}
                  </Button>
                  {target ? (
                    <Button variant="ghost" disabled={leading || Boolean(problem) || (next ?? Infinity) > target.maxBid} onClick={() => apply(bidUpTo(state, target.maxBid))}>
                      <Zap className="size-4" aria-hidden /> {rich(t('mgr.auc.bidToMax'), { max: <Money lakh={target.maxBid} /> })}
                    </Button>
                  ) : null}
                  <Button variant={leading ? 'gold' : 'secondary'} onClick={() => apply(hammer(state))}>
                    <Gavel className="size-4" aria-hidden /> {leading ? t('mgr.auc.soldToYou') : lot.leaderId ? t('mgr.auc.stop') : t('mgr.auc.skip')}
                  </Button>
                  {problem && !leading ? <p role="status" className="w-full text-[12.5px] text-brand-red">{problem}</p> : null}
                </div>
              ) : null}
              {lot.bids.length ? (
                <ol className="max-h-40 overflow-y-auto border-t border-line px-5 py-3 text-[12.5px]" aria-label={t('mgr.auc.bidsOn')}>
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
            <p className="p-5 text-[13px] text-ink-muted">{t('mgr.auc.waitingLot')}</p>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader title={t('mgr.auc.yourSquad')} subtitle={`${f.squadIds.length}/${MANAGER.rules.squadMax} · ${t('mgr.auc.osOf', { n: squadOf(state, f.id).filter((p) => p.overseas).length, max: MANAGER.rules.overseasSquadMax })}`} className="mb-2" />
            <p className="text-[20px] font-bold"><Money lakh={f.purse} /> <span className="text-[12px] font-normal text-ink-muted">{t('mgr.auc.left')}</span></p>
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
            <CardHeader title={t('mgr.auc.rivalPurses')} className="mb-2" />
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
            <CardHeader title={t('mgr.auc.log')} className="mb-2" />
            <ul className="max-h-48 overflow-y-auto text-[12px] text-ink-muted">
              {a.log.slice(0, 40).map((l, i) => <li key={i} className="py-0.5">{l}</li>)}
            </ul>
          </Card>
        </div>
      </div>

      {a.complete && short > 0 ? (
        <Card>
          <CardHeader title={t('mgr.auc.replacements')} subtitle={t('mgr.auc.replacementsSub')} className="mb-2" />
          <DataTable caption={t('mgr.auc.unsold')} head={[t('mgr.col.player'), t('mgr.col.role'), t('mgr.col.rating'), t('mgr.col.price'), '']}>
            {unsold.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Money lakh={Math.max(20, p.basePrice)} /></td>
                <td className="px-2 py-2"><Button className="min-h-9 px-3" onClick={() => apply(signReplacement(state, p.id), t('mgr.auc.signedToast', { name: p.name }))}>{t('mgr.auc.sign')}</Button></td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
      {a.complete ? (
        <Card>
          <CardHeader title={t('mgr.auc.allSales')} className="mb-2" />
          <DataTable caption={t('mgr.auc.salesCaption')} head={[t('mgr.col.player'), t('mgr.col.team'), t('mgr.col.price'), t('mgr.col.round')]}>
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
