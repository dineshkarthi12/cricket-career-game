import { useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { applyUpdate, promptInstall, usePwa } from '@/lib/pwa';

const DISMISS_KEY = 'cc.installDismissed';

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * One slim line under the top bar: a new version is ready, or the game can be
 * installed to the home screen and played offline. The install offer can be
 * dismissed for good (Settings keeps the button).
 */
export function AppBanner() {
  const { canInstall, updateReady } = usePwa();
  const [dismissed, setDismissed] = useState(dismissedBefore);

  if (updateReady) {
    return (
      <div role="status" className="mb-3 flex items-center gap-3 rounded-card bg-brand-navy px-4 py-2.5 text-[13px] text-white">
        <RefreshCw className="size-4 shrink-0 text-brand-gold" aria-hidden />
        <span className="flex-1">A new version of Cricket Career is ready.</span>
        <button type="button" onClick={applyUpdate} className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy">
          Update
        </button>
      </div>
    );
  }
  if (!canInstall || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Not remembered; it only comes back next visit.
    }
  };
  return (
    <div className="mb-3 flex items-center gap-3 rounded-card bg-brand-navy px-4 py-2.5 text-[13px] text-white">
      <Download className="size-4 shrink-0 text-brand-gold" aria-hidden />
      <span className="flex-1">Install Cricket Career to play from your home screen, even offline.</span>
      <button type="button" onClick={() => void promptInstall()} className="rounded-lg bg-brand-gold px-3 py-1.5 text-[12.5px] font-semibold text-brand-navy">
        Install app
      </button>
      <button type="button" onClick={dismiss} aria-label="Not now" className="rounded p-1 text-white/70 hover:text-white">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
