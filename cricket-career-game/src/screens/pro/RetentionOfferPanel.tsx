import { useState } from 'react';
import { Handshake } from 'lucide-react';
import { formatLakh, franchiseName } from '@/lib/pro';
import { useGameStore } from '@/store/gameStore';
import type { RetentionOffer } from '@/types';

const RAISES = [10, 25, 50];

/**
 * A mega-auction retention offer: accept, decline for a better offer, or
 * name a price. The owner's budget is not shown - ask for too much and the
 * answer is the auction.
 */
export function RetentionOfferPanel({ offer, compact = false }: { offer: RetentionOffer; compact?: boolean }) {
  const answer = useGameStore((s) => s.answerRetention);
  const [ask, setAsk] = useState('');
  const final = offer.salary >= offer.limit;
  const askLakh = Math.round(Number(ask) * 100);
  const name = franchiseName(offer.franchiseId);
  return (
    <div className="flex flex-wrap items-start gap-3">
      {compact ? <Handshake className="size-7 text-brand-blue" aria-hidden /> : null}
      <div className="min-w-[14rem] flex-1">
        <p className="text-[14px] font-semibold text-ink">
          {name} want to retain you: {formatLakh(offer.salary)} a season{final ? ' (final offer)' : offer.round > 1 ? ' (raised offer)' : ''}
        </p>
        <p className="text-[12.5px] text-ink-muted">
          Your three-season contract ({formatLakh(offer.previous)}) is up and it is a mega auction year - only four players stay. Decline and the owner {final ? 'lets you go into the auction' : 'may raise the offer'}; ask for more than the owner's budget and you go into the auction. Unanswered by 16 December, your agent accepts.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => answer({ kind: 'ACCEPT' })} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">Accept {formatLakh(offer.salary)}</button>
          <button type="button" onClick={() => answer({ kind: 'DECLINE' })} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">{final ? 'Decline - go to the auction' : 'Decline'}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-ink-muted">Ask for:</span>
          {RAISES.map((r) => {
            const lakh = Math.round((offer.salary * (1 + r / 100)) / 25) * 25;
            return (
              <button key={r} type="button" onClick={() => answer({ kind: 'ASK', amount: lakh })} className="rounded-full border border-line bg-surface px-3 py-1 font-semibold text-ink">
                +{r}% ({formatLakh(lakh)})
              </button>
            );
          })}
          <label className="flex items-center gap-1">
            <span className="sr-only">Your price in crore</span>
            <input type="number" min={0} step={0.25} inputMode="decimal" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="₹ Cr" className="w-20 rounded-full border border-line bg-surface px-3 py-1 text-ink" />
          </label>
          <button type="button" disabled={!(askLakh > 0)} onClick={() => answer({ kind: 'ASK', amount: askLakh })} className="rounded-full bg-brand-gold px-3 py-1 font-semibold text-brand-navy disabled:opacity-50">Ask</button>
        </div>
      </div>
    </div>
  );
}
