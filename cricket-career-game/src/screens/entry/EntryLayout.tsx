import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/layout/Logo';

interface EntryLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Optional "back" link shown above the title. */
  back?: { label: string; to: string };
}

/**
 * Full-page frame for the screens that come before a career is loaded. It
 * deliberately has no sidebar - there is nothing to navigate to until the
 * player has picked a slot.
 */
export function EntryLayout({ title, subtitle, children, back }: EntryLayoutProps) {
  return (
    <div className="min-h-screen bg-page">
      <header className="relative overflow-hidden bg-brand-navy">
        <img
          src="/assets/banner-bg.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="banner-wash absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          {back ? (
            <Link
              to={back.to}
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/80 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {back.label}
            </Link>
          ) : null}
          <Logo variant="light" />
          <h1 className="mt-4 text-[26px] leading-tight font-bold text-white">{title}</h1>
          <p className="mt-1 max-w-xl text-[13.5px] text-white/75">{subtitle}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</main>

      <p className="font-hand pb-8 text-center text-[21px] text-ink-muted">
        Every great player was once a beginner.
      </p>
    </div>
  );
}
