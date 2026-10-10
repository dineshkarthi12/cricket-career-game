import { useState } from 'react';
import { Handshake } from 'lucide-react';
import { formatLakh, franchiseName } from '@/lib/pro';
import { useGameStore } from '@/store/gameStore';
import { useT } from '@/i18n/react';
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
  const t = useT();
  return (
    <div className="flex flex-wrap items-start gap-3">
      {compact ? <Handshake className="size-7 text-brand-blue" aria-hidden /> : null}
      <div className="min-w-[14rem] flex-1">
        <p className="text-[14px] font-semibold text-ink">
          {t('pro.ret.offer', { team: name, salary: formatLakh(offer.salary), note: final ? '@pro.ret.final' : offer.round > 1 ? '@pro.ret.raised' : '' })}
        </p>
        <p className="text-[12.5px] text-ink-muted">
          {t('pro.ret.body', { previous: formatLakh(offer.previous), then: final ? '@pro.ret.letsGo' : '@pro.ret.mayRaise' })}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => answer({ kind: 'ACCEPT' })} className="rounded-full bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white">{t('pro.ret.accept', { salary: formatLakh(offer.salary) })}</button>
          <button type="button" onClick={() => answer({ kind: 'DECLINE' })} className="rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink">{final ? t('pro.ret.declineFinal') : t('decisions.decline')}</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-ink-muted">{t('pro.ret.askFor')}</span>
          {RAISES.map((r) => {
            const lakh = Math.round((offer.salary * (1 + r / 100)) / 25) * 25;
            return (
              <button key={r} type="button" onClick={() => answer({ kind: 'ASK', amount: lakh })} className="rounded-full border border-line bg-surface px-3 py-1 font-semibold text-ink">
                +{r}% ({formatLakh(lakh)})
              </button>
            );
          })}
          <label className="flex items-center gap-1">
            <span className="sr-only">{t('pro.ret.priceCr')}</span>
            <input type="number" min={0} step={0.25} inputMode="decimal" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="₹ Cr" className="w-20 rounded-full border border-line bg-surface px-3 py-1 text-ink" />
          </label>
          <button type="button" disabled={!(askLakh > 0)} onClick={() => answer({ kind: 'ASK', amount: askLakh })} className="rounded-full bg-brand-gold px-3 py-1 font-semibold text-brand-navy disabled:opacity-50">{t('pro.ret.ask')}</button>
        </div>
      </div>
    </div>
  );
}
