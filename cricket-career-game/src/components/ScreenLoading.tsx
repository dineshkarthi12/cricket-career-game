/** Shown while a screen's code loads: a quiet skeleton in the page's own frame. */
export function ScreenLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3 py-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-line" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-card bg-surface shadow-card" />
        <div className="h-40 animate-pulse rounded-card bg-surface shadow-card" />
      </div>
      <div className="h-56 animate-pulse rounded-card bg-surface shadow-card" />
    </div>
  );
}
