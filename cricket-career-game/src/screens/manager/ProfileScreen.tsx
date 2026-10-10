/** Manager profile and career progression: the rank ladder, responsibilities, the board, job offers and retirement. */
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, ConfirmDialog, ProgressBar, Stepper, type StepItem } from '@/components';
import { MANAGER, acceptJob, holds, jobOffers, promotionOutlook, retireManager, setFullControl } from '@/engine/manager';
import type { Responsibility } from '@/types/manager';
import { useManagerStore } from '@/store/managerStore';
import { rich, useT } from '@/i18n/react';
import { Button, InfoCard, PageHeader, StatLine, rankLabel, shortOf, useManager } from './ui';

/** Labels: `mgr.resp.<id>`. */
const RESPONSIBILITIES: Responsibility[] = ['SCOUTING', 'TRIALS', 'AUCTION', 'DEVELOPMENT', 'SELECTION', 'TACTICS', 'MATCHDAY', 'CONTRACTS', 'STAFF', 'FINANCE'];

export default function ProfileScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const exportCareer = useManagerStore((s) => s.exportCareer);
  const navigate = useNavigate();
  const [confirmRetire, setConfirmRetire] = useState(false);
  const p = state.profile;
  const order = MANAGER.ranks.order;
  const current = order.indexOf(p.rank);
  const steps: StepItem[] = order.map((r, i) => ({ id: r, index: i + 1, label: rankLabel(r), status: i < current ? 'done' : i === current ? 'current' : 'locked' }));
  const outlook = promotionOutlook(state);
  const all = RESPONSIBILITIES;
  const offers = jobOffers(state);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.prof.title')} subtitle={`${p.name} · ${p.pathway === 'SCOUTING' ? t('mgr.prof.pathScouting') : t('mgr.prof.pathDirect')} · ${t(`mgr.prof.diff.${p.difficulty}`)}`}>
        <Button variant="secondary" onClick={exportCareer}>{t('mgr.prof.export')}</Button>
      </PageHeader>

      <Card>
        <CardHeader title={t('mgr.prof.path')} subtitle={t('mgr.prof.pathSub')} className="mb-3" />
        <Stepper steps={steps} endLabel={t('mgr.nav.legacy')} />
        {outlook.next ? (
          <p className="mt-3 text-[13px] text-ink">
            {rich(t('mgr.prof.next', { rep: outlook.reputationNeeded ?? 0, now: Math.round(p.reputation), pct: Math.round((outlook.objectiveShare ?? 0) * 100) }), { rank: <strong>{rankLabel(outlook.next)}</strong> })}
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-ink">{t('mgr.prof.top')}</p>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title={t('mgr.prof.standing')}>
          <div className="mb-2">
            <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">{t('mgr.reputation')}</span><span className="font-semibold">{Math.round(p.reputation)}/100</span></div>
            <ProgressBar value={p.reputation} tone="gold" label={t('mgr.reputation')} />
          </div>
          <div className="mb-2">
            <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">{t('mgr.boardConfidence')}</span><span className="font-semibold">{Math.round(p.boardConfidence)}%</span></div>
            <ProgressBar value={p.boardConfidence} tone={p.boardConfidence < MANAGER.board.warnBelow ? 'red' : 'green'} label={t('mgr.boardConfidence')} />
            {p.boardConfidence < MANAGER.board.warnBelow ? <p className="mt-1 text-[12px] text-brand-red">{t('mgr.prof.sackWarn', { n: MANAGER.board.sackBelow })}</p> : null}
          </div>
          <StatLine label={t('mgr.prof.seasons')} value={p.seasonsManaged} />
          <StatLine label={t('mgr.prof.tfp')} value={`${p.trophies} / ${p.finals} / ${p.playoffApps}`} />
          <StatLine label={t('mgr.prof.experience')} value={t('mgr.prof.matchesN', { n: p.experience })} />
          <StatLine label={t('mgr.prof.discoveries')} value={p.discoveries.length} />
        </InfoCard>

        <InfoCard title={t('mgr.prof.resp')}>
          <ul className="grid gap-1.5">
            {all.map((r) => {
              const has = holds(state, r);
              return (
                <li key={r} className="flex items-center gap-2 text-[13px]">
                  {has ? <Check className="size-4 text-brand-green" aria-hidden /> : <Lock className="size-4 text-ink-soft" aria-hidden />}
                  <span className={has ? 'text-ink' : 'text-ink-muted'}>{t(`mgr.resp.${r}`)}</span>
                  <span className="sr-only">{has ? t('mgr.prof.yours') : t('mgr.prof.notYours')}</span>
                </li>
              );
            })}
          </ul>
        </InfoCard>

        <InfoCard title={`${t('mgr.boardObjectives')} ${state.season.year}`}>
          <ul className="grid gap-2">
            {state.season.objectives.map((o) => (
              <li key={o.id} className="text-[13px] text-ink">
                {o.label}
                <span className="ml-1 text-[11.5px] text-ink-muted">{t('mgr.prof.weight', { n: o.weight })}</span>
                {o.met !== null ? <span className={o.met ? 'ml-1 font-semibold text-brand-green' : 'ml-1 font-semibold text-brand-red'}>{o.met ? t('mgr.prof.met') : t('mgr.prof.missed')}</span> : null}
              </li>
            ))}
          </ul>
        </InfoCard>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{t('mgr.fullControl')} {p.fullControl ? <span className="text-brand-green">· {t('mgr.prof.on')}</span> : <span className="text-ink-muted">· {t('mgr.prof.off')}</span>}</p>
          <p className="text-[12.5px] text-ink-muted">
            {p.fullControl ? t('mgr.prof.fcOn') : t('mgr.prof.fcOff')}
          </p>
        </div>
        <Button
          variant={p.fullControl ? 'secondary' : 'gold'}
          disabled={p.retired}
          onClick={() => apply(setFullControl(state, !p.fullControl), p.fullControl ? t('mgr.prof.toastStaff') : t('mgr.prof.toastFull'))}
        >
          {p.fullControl ? t('mgr.prof.handJobs') : t('mgr.takeFullControl')}
        </Button>
      </Card>

      {p.unemployed ? (
        <Card>
          <CardHeader title={t('mgr.prof.jobs')} subtitle={t('mgr.prof.jobsSub')} className="mb-3" />
          {offers.length === 0 ? <p className="text-[13px] text-ink-muted">{t('mgr.prof.noOffers')}</p> : null}
          <ul className="grid gap-2 sm:grid-cols-3">
            {offers.map((o) => (
              <li key={o.franchiseId}>
                <Button className="w-full" onClick={() => apply(acceptJob(state, o.franchiseId), t('mgr.prof.freshStart')) && navigate('/manager')}>
                  {shortOf(state, o.franchiseId)} - {rankLabel(o.rank)}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-ink">{t('mgr.prof.retirement')}</p>
          <p className="text-[12.5px] text-ink-muted">{t('mgr.prof.retirementSub')}</p>
        </div>
        <Button variant="danger" disabled={p.retired || (state.season.phase !== 'SEASON_END' && !p.unemployed)} onClick={() => setConfirmRetire(true)}>
          {p.retired ? t('mgr.prof.retired') : t('mgr.prof.retire')}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmRetire}
        danger
        title={t('mgr.prof.retireTitle')}
        message={t('mgr.prof.retireBody')}
        confirmLabel={t('mgr.prof.retire')}
        onCancel={() => setConfirmRetire(false)}
        onConfirm={() => {
          setConfirmRetire(false);
          if (apply(retireManager(state))) navigate('/manager/legacy');
        }}
      />
    </div>
  );
}
