import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupPwa } from './pwa';

describe('looking for a new version', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('asks again when the app comes back to the front, and every half hour', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROD', true);
    const update = vi.fn(() => Promise.resolve());
    const reg = { update, waiting: null, installing: null, addEventListener: vi.fn() };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(() => Promise.resolve(reg)), controller: {} } });
    setupPwa();
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js'));
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
