/**
 * The installable app: registers the service worker in production builds,
 * keeps the browser's install prompt so the game can offer "Install app",
 * and reports when a new version is ready.
 */
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** The browser offered installation (Chrome, Edge, Android). */
  canInstall: boolean;
  /** Running as an installed app. */
  installed: boolean;
  /** A new version is waiting; reloading picks it up. */
  updateReady: boolean;
  /** iOS Safari installs from the Share menu instead of a prompt. */
  iosManual: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;

function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export const usePwa = create<PwaState>(() => ({
  canInstall: false,
  installed: standalone(),
  updateReady: false,
  iosManual: isIos() && !standalone(),
}));

/** Shows the browser's install dialog. Resolves true if the player installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePwa.setState({ canInstall: false, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

/** Activates the waiting version and reloads. */
export function applyUpdate(): void {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage('SKIP_WAITING');
}

export function setupPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    usePwa.setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePwa.setState({ canInstall: false, installed: true, iosManual: false });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // A worker installed while another controls the page is an update.
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              waiting = worker;
              usePwa.setState({ updateReady: true });
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          waiting = reg.waiting;
          usePwa.setState({ updateReady: true });
        }
        reg.addEventListener('updatefound', () => track(reg.installing));
      })
      .catch(() => {
        // Offline play is a bonus: the game still works without it.
      });
  });
}
