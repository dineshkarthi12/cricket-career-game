import { Crown, Repeat } from 'lucide-react';
import { Card } from '@/components';
import { formatLakh, franchiseName } from '@/lib/pro';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

/** Offers waiting on the player: a vice-captaincy or captaincy, or an IPL trade. */
export function DecisionsCard({ state }: { state: GameState }) {
  const answerLeadership = useGameStore((s) => s.answerLeadership);
  const answerTrade = useGameStore((s) => s.answerTrade);
  const offer = state.pro?.leadership.offer;
  const trade = state.pro?.ipl.tradeOffer;
  if (!offer && !trade) return null;
  return (
    <Card className="border-brand-blue">
      {offer ? (
        <div className="flex flex-wrap items-center gap-3">
          <Crown className="size-7 text-brand-gold" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">Offer: {offer.role === 'CAPTAIN' ? 'captain' : 'vice-captain'} of {offer.teamName}</p>
            <p className="text-[12.5px] text-ink-muted">{offer.reason}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => answerLeadership(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">Accept</button>
            <button type="button" onClick={() => answerLeadership(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">Decline</button>
          </div>
        </div>
      ) : null}
      {trade ? (
        <div className={`flex flex-wrap items-center gap-3 ${offer ? 'mt-3 border-t border-line pt-3' : ''}`}>
          <Repeat className="size-7 text-brand-blue" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">IPL trade offer: {franchiseName(trade.franchiseId)}</p>
            <p className="text-[12.5px] text-ink-muted">They take over your contract ({formatLakh(trade.salary)}) and want you in their XI.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => answerTrade(true)} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">Accept trade</button>
            <button type="button" onClick={() => answerTrade(false)} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">Stay put</button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
