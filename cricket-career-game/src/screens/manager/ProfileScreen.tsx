/** Manager profile and career progression: the rank ladder, responsibilities, the board, job offers and retirement. */
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, ConfirmDialog, ProgressBar, Stepper, type StepItem } from '@/components';
import { MANAGER, acceptJob, jobOffers, promotionOutlook, retireManager } from '@/engine/manager';
import type { Responsibility } from '@/types/manager';
import { useManagerStore } from '@/store/managerStore';
import { Button, InfoCard, PageHeader, StatLine, shortOf, useManager } from './ui';

const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  SCOUTING: 'Scouting network',
  TRIALS: 'Trials & recruitment',
  AUCTION: 'Auction & retentions',
  DEVELOPMENT: 'Player development',
  SELECTION: 'Team selection',
  TACTICS: 'Tactics',
  MATCHDAY: 'Matchday decisions',
  CONTRACTS: 'Contracts',
  STAFF: 'Staff hiring',
  FINANCE: 'Budgets',
};

export default function ProfileScreen() {
  const { state, apply } = useManager();
  const exportCareer = useManagerStore((s) => s.exportCareer);
  const navigate = useNavigate();
  const [confirmRetire, setConfirmRetire] = useState(false);
  const p = state.profile;
  const order = MANAGER.ranks.order;
  const current = order.indexOf(p.rank);
  const steps: StepItem[] = order.map((r, i) => ({ id: r, index: i + 1, label: MANAGER.ranks.label[r], status: i < current ? 'done' : i === current ? 'current' : 'locked' }));
  const outlook = promotionOutlook(state);
  const held = MANAGER.ranks.responsibilities[p.rank] as readonly Responsibility[];
  const all = Object.keys(RESPONSIBILITY_LABEL) as Responsibility[];
  const offers = jobOffers(state);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Manager career" subtitle={`${p.name} · ${p.pathway === 'SCOUTING' ? 'Scouting pathway' : 'Direct appointment'} · ${p.difficulty.toLowerCase()} difficulty`}>
        <Button variant="secondary" onClick={exportCareer}>Export save</Button>
      </PageHeader>

      <Card>
        <CardHeader title="Career path" subtitle="Promotion is earned at the season review - reputation and objectives, never automatic." className="mb-3" />
        <Stepper steps={steps} endLabel="Legacy" />
        {outlook.next ? (
          <p className="mt-3 text-[13px] text-ink">
            Next: <strong>{MANAGER.ranks.label[outlook.next]}</strong> - needs reputation {outlook.reputationNeeded} (now {Math.round(p.reputation)}) and {Math.round((outlook.objectiveShare ?? 0) * 100)}% of the board's objectives met.
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-ink">You hold the top job. Now build a dynasty.</p>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title="Standing">
          <div className="mb-2">
            <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">Reputation</span><span className="font-semibold">{Math.round(p.reputation)}/100</span></div>
            <ProgressBar value={p.reputation} tone="gold" label="Reputation" />
          </div>
          <div className="mb-2">
            <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">Board confidence</span><span className="font-semibold">{Math.round(p.boardConfidence)}%</span></div>
            <ProgressBar value={p.boardConfidence} tone={p.boardConfidence < MANAGER.board.warnBelow ? 'red' : 'green'} label="Board confidence" />
            {p.boardConfidence < MANAGER.board.warnBelow ? <p className="mt-1 text-[12px] text-brand-red">Below {MANAGER.board.sackBelow}% at a review and you are out.</p> : null}
          </div>
          <StatLine label="Seasons managed" value={p.seasonsManaged} />
          <StatLine label="Titles / finals / playoffs" value={`${p.trophies} / ${p.finals} / ${p.playoffApps}`} />
          <StatLine label="Experience" value={`${p.experience} matches`} />
          <StatLine label="Discoveries" value={p.discoveries.length} />
        </InfoCard>

        <InfoCard title="Your responsibilities">
          <ul className="grid gap-1.5">
            {all.map((r) => {
              const has = held.includes(r);
              return (
                <li key={r} className="flex items-center gap-2 text-[13px]">
                  {has ? <Check className="size-4 text-brand-green" aria-hidden /> : <Lock className="size-4 text-ink-soft" aria-hidden />}
                  <span className={has ? 'text-ink' : 'text-ink-muted'}>{RESPONSIBILITY_LABEL[r]}</span>
                  <span className="sr-only">{has ? '(yours)' : '(not yet yours)'}</span>
                </li>
              );
            })}
          </ul>
        </InfoCard>

        <InfoCard title={`Board objectives ${state.season.year}`}>
          <ul className="grid gap-2">
            {state.season.objectives.map((o) => (
              <li key={o.id} className="text-[13px] text-ink">
                {o.label}
                <span className="ml-1 text-[11.5px] text-ink-muted">(weight {o.weight})</span>
                {o.met !== null ? <span className={o.met ? 'ml-1 font-semibold text-brand-green' : 'ml-1 font-semibold text-brand-red'}>{o.met ? 'Met' : 'Missed'}</span> : null}
              </li>
            ))}
          </ul>
        </InfoCard>
      </div>

      {p.unemployed ? (
        <Card>
          <CardHeader title="Job offers" subtitle="The board let you go. These franchises would take you on." className="mb-3" />
          {offers.length === 0 ? <p className="text-[13px] text-ink-muted">No offers. Retiring is the only option left.</p> : null}
          <ul className="grid gap-2 sm:grid-cols-3">
            {offers.map((o) => (
              <li key={o.franchiseId}>
                <Button className="w-full" onClick={() => apply(acceptJob(state, o.franchiseId), 'A fresh start.') && navigate('/manager')}>
                  {shortOf(state, o.franchiseId)} - {MANAGER.ranks.label[o.rank]}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-ink">Retirement</p>
          <p className="text-[12.5px] text-ink-muted">Your decision alone, at the end of a season. Everything you built stays in your legacy.</p>
        </div>
        <Button variant="danger" disabled={p.retired || (state.season.phase !== 'SEASON_END' && !p.unemployed)} onClick={() => setConfirmRetire(true)}>
          {p.retired ? 'Retired' : 'Retire'}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmRetire}
        danger
        title="Retire from management?"
        message="Your manager career ends here. The save, its seasons and your legacy are kept, but no more seasons can be played in it."
        confirmLabel="Retire"
        onCancel={() => setConfirmRetire(false)}
        onConfirm={() => {
          setConfirmRetire(false);
          if (apply(retireManager(state))) navigate('/manager/legacy');
        }}
      />
    </div>
  );
}
