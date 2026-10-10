import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { tr } from '@/i18n/core';

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the route) clears the error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * A screen that fails to render shows a way out instead of a blank page.
 * The career is saved in the browser, so reloading loses nothing but the
 * week in progress.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed to render', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-10 flex max-w-md flex-col items-center gap-3 rounded-card bg-surface px-6 py-8 text-center shadow-card">
        <span className="grid size-11 place-items-center rounded-full bg-brand-red/10">
          <AlertTriangle className="size-5 text-brand-red" aria-hidden />
        </span>
        <p className="text-[16px] font-semibold text-ink">{tr('misc.comp.errTitle')}</p>
        <p className="text-[13px] text-ink-muted">{tr('misc.comp.errBody')}</p>
        <p className="max-w-full truncate text-[11.5px] text-ink-soft">{this.state.error.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white">
            {tr('misc.comp.reload')}
          </button>
          <a href="/" className="rounded-xl border border-line px-4 py-2 text-[13px] font-semibold text-ink">
            {tr('misc.comp.dashboard')}
          </a>
        </div>
      </div>
    );
  }
}
