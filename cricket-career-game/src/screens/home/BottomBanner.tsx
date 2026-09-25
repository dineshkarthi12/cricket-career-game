import { Link } from 'react-router-dom';
import { Logo } from '@/layout/Logo';

/** Navy closing banner: the game's promise, and the way back into the career. */
export function BottomBanner() {
  return (
    <div className="relative overflow-hidden rounded-card bg-brand-navy shadow-card">
      <img
        src="/assets/banner-bg.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div className="banner-wash absolute inset-0" aria-hidden />

      <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Logo variant="light" className="shrink-0" />

        <p className="font-hand hidden flex-1 text-center text-[27px] leading-none text-white lg:block">
          More Than A Game.
        </p>

        <div className="flex items-center gap-4">
          <p className="hidden text-[12px] font-semibold tracking-[0.08em] text-white/90 sm:block">
            REAL PLAYERS. REAL JOURNEYS.
          </p>
          <Link
            to="/calendar"
            className="rounded-lg bg-brand-gold px-5 py-2.5 text-[13px] font-bold tracking-[0.04em] text-brand-navy transition-colors hover:bg-[#ffd633]"
          >
            Continue Career
          </Link>
        </div>
      </div>
    </div>
  );
}
