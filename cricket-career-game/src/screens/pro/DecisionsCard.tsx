import { useT } from '@/i18n/react';
import { Crown, Repeat } from 'lucide-react';
import { Card } from '@/components';
import { formatLakh, franchiseName } from '@/lib/pro';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';
import { RetentionOfferPanel } from './RetentionOfferPanel';

/** Offers waiting on the player: a vice-captaincy or captaincy, an IPL trade or a retention offer. */
export function DecisionsCard({ state }: { state: GameState }) {
  const answerLeadership = useGameStore((s) => s.answerLeadership);
  const answerTrade = useGameStore((s) => s.answerTrade);
  const offer = state.pro?.leadership.offer;
  const trade = state.pro?.ipl.tradeOffer;
  const retention = state.pro?.ipl.retentionOffer;
  const t = useT();
  if (!offer && !trade && !retention) return null;
  return (
    <Card className="border-brand-blue">
      {offer ? (
        <div className="flex flex-wrap items-center gap-3">
          <Crown className="size-7 text-brand-gold" aria-hidden />
          <div className="min-w-[14rem] flex-1">
            <p className="text-[14px] font-semibold text-ink">{t('decisions.offer', { role: t(offer.role === 'CAPTAIN' ? 'decisions.captain' : 'decisions.vice'), team: offer.teamName })}</p>
            <p className="text-[12.5px] text-ink-muted">{offer.reason}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => answerLeadership(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">{t('decisions.accept')}</button>
            <button type="button" onClick={() => answerLeadership(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">{t('decisions.decline')}</button>
          </div>
        </div>
      ) : null}
      {trade ? (
        <div className={`flex flex-wrap items-center gap-3 ${offer ? 'mt-3 border-t border-line pt-3' : ''}`}>
          <Repeat className="size-7 text-brand-blue" aria-hidden />
          <div className="min-w-[14rem] flex-1">
            <p className="text-[14px] font-semibold text-ink">{t('decisions.trade', { team: franchiseName(trade.franchiseId) })}</p>
            <p className="text-[12.5px] text-ink-muted">{t('decisions.tradeBody', { salary: formatLakh(trade.salary) })}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => answerTrade(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">{t('decisions.acceptTrade')}</button>
            <button type="button" onClick={() => answerTrade(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">{t('decisions.stay')}</button>
          </div>
        </div>
      ) : null}
      {retention ? (
        <div className={offer || trade ? 'mt-3 border-t border-line pt-3' : ''}>
          <RetentionOfferPanel offer={retention} compact />
        </div>
      ) : null}
    </Card>
  );
}
