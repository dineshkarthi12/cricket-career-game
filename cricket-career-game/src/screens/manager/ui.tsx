/**
 * Shared pieces for the IPL Manager screens, built on the game's design
 * system (Card, Badge, ProgressBar...) so the mode keeps the Cricket Career
 * 26 look: white cards on a light-blue page, blue actions, gold accents.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, Crest, type BadgeTone } from '@/components';
import { cn } from '@/lib/cn';
import { MANAGER, formatMoney, holds, type ActionResult } from '@/engine/manager';
import { roleLabel } from '@/lib/format';
import { useManagerStore } from '@/store/managerStore';
import type { Franchise, ManagedPlayer, ManagerState, Responsibility, ScoutReport } from '@/types/manager';

/** The loaded manager career. Screens render only inside the shell, which guarantees one. */
export function useManager(): { state: ManagerState; apply: (r: ActionResult, success?: string) => boolean; replace: (s: ManagerState) => void } {
  const state = useManagerStore((s) => s.state)!;
  const apply = useManagerStore((s) => s.apply);
  const replace = useManagerStore((s) => s.replace);
  return { state, apply, replace };
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-blue text-white hover:bg-brand-blue/90',
  secondary: 'border border-line bg-surface text-ink hover:bg-page',
  gold: 'bg-brand-gold text-brand-navy hover:bg-brand-gold/90',
  danger: 'bg-brand-red text-white hover:bg-brand-red/90',
  ghost: 'bg-brand-blue-soft text-brand-blue hover:bg-brand-blue/15',
};

/** A thumb-friendly button: at least 44px tall, visible focus, a real disabled state. */
export function Button({ variant = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', VARIANT[variant], className)}
    >
      {children}
    </Link>
  );
}

export function FranchiseCrest({ franchise, size = 36 }: { franchise: Pick<Franchise, 'monogram' | 'colors' | 'name'>; size?: number }) {
  return <Crest crest={{ monogram: franchise.monogram, primaryColor: franchise.colors[0], secondaryColor: franchise.colors[1], shape: 'SHIELD' }} size={size} label={franchise.name} />;
}

export function Money({ lakh, className }: { lakh: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatMoney(lakh)}</span>;
}

/** Shown in place of a screen's controls when the manager's rank does not include the job. */
export function LockedNotice({ responsibility, state }: { responsibility: Responsibility; state: ManagerState }) {
  if (holds(state, responsibility)) return null;
  const nextRank = MANAGER.ranks.order.find((r) => (MANAGER.ranks.responsibilities[r] as readonly string[]).includes(responsibility));
  return (
    <div role="note" className="mb-3 flex items-start gap-3 rounded-card border border-brand-gold/40 bg-brand-gold/10 px-4 py-3">
      <Lock className="mt-0.5 size-4 shrink-0 text-[#8a6a00]" aria-hidden />
      <p className="text-[13px] text-ink">
        {state.profile.unemployed
          ? 'You are between jobs - accept an offer on your profile to get back to work.'
          : `As ${MANAGER.ranks.label[state.profile.rank]} this is handled by the franchise's staff. It becomes yours as ${nextRank ? MANAGER.ranks.label[nextRank] : 'a senior manager'} - earned at a season review.`}{' '}
        <Link to="/manager/profile" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
          See your career path
        </Link>
      </p>
    </div>
  );
}

export function RoleTag({ player }: { player: Pick<ManagedPlayer, 'role' | 'overseas'> }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-muted">
      {roleLabel(player.role)}
      {player.overseas ? (
        <span className="rounded bg-brand-navy px-1 text-[10px] font-bold text-white" title="Overseas player">
          OS
        </span>
      ) : null}
    </span>
  );
}

/** A scouting estimate as the user sees it: "72 ± 6". Never the true figure. */
export function Estimate({ report, field = 'overall' }: { report: ScoutReport | undefined; field?: 'overall' | 'potential' }) {
  if (!report) return <span className="text-ink-soft" title="Not scouted">?</span>;
  const value = field === 'overall' ? report.estOverall : report.estPotential;
  const u = Math.round(report.uncertainty * (field === 'potential' ? 1.6 : 1));
  return (
    <span className="tabular-nums" title={`${report.observations} observation${report.observations === 1 ? '' : 's'}`}>
      <span className="font-semibold text-ink">{value}</span>
      <span className="text-[11px] text-ink-muted"> ±{u}</span>
    </span>
  );
}

export function ToneBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <Badge tone={tone} className={cn('px-2 py-0.5 text-[11.5px]', className)}>{children}</Badge>;
}

export function StatLine({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      <span className="text-right text-[13px] font-semibold text-ink">
        {value}
        {hint ? <span className="block text-[11px] font-normal text-ink-muted">{hint}</span> : null}
      </span>
    </div>
  );
}

/** A simple accessible data table. Scrolls sideways on narrow screens instead of breaking the page. */
export function DataTable({ caption, head, children, className }: { caption: string; head: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-1 overflow-x-auto px-1', className)}>
      <table className="w-full min-w-[520px] border-collapse text-left text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-[11px] tracking-wide text-ink-muted uppercase">
            {head.map((h) => (
              <th key={h} scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, disabled, className }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; className?: string }) {
  return (
    <label className={cn('block text-[12px] font-semibold text-ink-muted', className)}>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SectionGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 lg:grid-cols-2', className)}>{children}</div>;
}

export function InfoCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <h2 className="mb-2 text-[14px] font-semibold text-ink">{title}</h2>
      {children}
    </Card>
  );
}

export function nameOf(state: ManagerState, id: string | null | undefined): string {
  if (!id) return '-';
  return state.players[id]?.name ?? state.franchises[id]?.short ?? id;
}

export function shortOf(state: ManagerState, franchiseId: string | null | undefined): string {
  if (!franchiseId) return '-';
  return state.franchises[franchiseId]?.short ?? franchiseId;
}

export const fitnessTone = (fatigue: number): BadgeTone => (fatigue >= 75 ? 'red' : fatigue >= 50 ? 'orange' : 'green');
export const formWord = (form: number) => (form >= 70 ? 'Excellent' : form >= 55 ? 'Good' : form >= 40 ? 'Average' : 'Poor');
