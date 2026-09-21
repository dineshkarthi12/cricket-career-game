import { useState } from 'react';
import { Crown, Heart, MapPin, Pencil, Play, Smile, TrendingUp } from 'lucide-react';
import { HeroStatTile } from '@/components';
import { StoryModal } from './StoryModal';
import { battingStyleLabel, bowlingStyleLabel, countryFlag, formLabel, moraleLabel } from '@/lib/format';
import type { GameState } from '@/types';

/**
 * The hero banner: photograph, the player's identity, the four condition
 * tiles and the handwritten mottos from design/dashboard.png.
 */
export function HeroBanner({ state }: { state: GameState }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const { player } = state;
  const name = `${player.firstName} ${player.lastName}`.trim();
  const flag = countryFlag(player.country);

  return (
    <>
      <div className="relative overflow-hidden rounded-card shadow-card">
        <img
          src="/assets/hero-bg.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-[50%_26%]"
        />
        <img
          src="/assets/player-hero.png"
          alt=""
          aria-hidden
          className="absolute top-1.5 right-2 hidden h-[104%] w-auto object-contain object-top sm:block md:right-[8%] xl:right-[42%]"
        />
        <div className="hero-wash absolute inset-0" aria-hidden />

        {/* Handwritten mottos, sitting over the photograph. */}
        <p
          className="font-hand pointer-events-none absolute top-[16%] left-[31%] hidden -rotate-3 text-[25px] leading-[1.05] font-medium text-brand-navy/90 xl:block"
          aria-hidden
        >
          Small
          <br />
          <span className="ml-5">Town Boy</span>
          <br />
          <span className="ml-3 text-[30px]">Big Dreams</span>
        </p>
        <div
          className="pointer-events-none absolute top-[11%] right-[29%] hidden w-[168px] xl:block"
          aria-hidden
        >
          <Crown className="mb-0.5 ml-8 size-5 fill-brand-gold text-brand-gold" strokeWidth={1.5} />
          <p className="font-hand -rotate-2 text-[21px] leading-[1.08] font-semibold tracking-wide text-brand-navy uppercase">
            Every great player was once a beginner.
          </p>
        </div>

        <div className="relative flex min-h-[300px] flex-col justify-between gap-6 p-5 xl:min-h-[318px]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[30px] leading-none font-bold text-brand-navy">{name}</h1>
              <button
                type="button"
                aria-label="Edit player details"
                className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface/70 hover:text-brand-blue"
              >
                <Pencil className="size-[17px]" strokeWidth={2} />
              </button>
            </div>

            <p className="mt-1.5 text-[14px] font-medium text-ink">
              {battingStyleLabel(player.battingStyle)}
              <span className="mx-1.5 text-ink-soft">•</span>
              {bowlingStyleLabel(player.bowlingStyle)}
            </p>

            <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-ink-muted">
              <MapPin className="size-4 text-brand-navy" strokeWidth={2} />
              {player.hometown}, {player.state}
            </p>

            <p className="mt-1.5 flex items-center gap-2 text-[13.5px] text-ink-muted">
              <span>
                Age <span className="font-semibold text-ink">{player.age}</span>
              </span>
              <span className="text-line">|</span>
              <span className="flex items-center gap-1.5">
                {flag ? <span aria-hidden>{flag}</span> : null}
                {player.country}
              </span>
            </p>

            <p className="font-hand mt-2.5 max-w-[260px] text-[20px] leading-[1.2] text-ink">
              “ {player.motto} ”
            </p>
          </div>

          <div className="flex items-end gap-2 sm:gap-2.5">
            <HeroStatTile label="OVR" tint>
              <span className="grid size-[38px] place-items-center rounded-full bg-brand-green text-[16px] font-bold text-white ring-[3px] ring-brand-green/30">
                {player.overall}
              </span>
            </HeroStatTile>

            <HeroStatTile label="Form">
              <TrendingUp className="size-[22px] text-brand-green" strokeWidth={2.2} />
              <span className="text-[14px] font-semibold text-ink">
                {formLabel(player.condition.formBand)}
              </span>
            </HeroStatTile>

            <HeroStatTile label="Fitness">
              <Heart className="size-[22px] text-brand-navy" strokeWidth={1.8} />
              <span className="text-[14px] font-semibold text-ink">{player.condition.fitness}%</span>
            </HeroStatTile>

            <HeroStatTile label="Morale">
              <Smile className="size-[22px] text-brand-navy" strokeWidth={1.8} />
              <span className="text-[14px] font-semibold text-ink">
                {moraleLabel(player.condition.moraleBand)}
              </span>
            </HeroStatTile>

            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              className="ml-auto hidden items-center gap-3 rounded-full py-1 pr-4 pl-1 text-[14px] font-medium text-white transition-colors hover:bg-white/10 lg:flex xl:mr-[27%]"
            >
              <span className="grid size-11 place-items-center rounded-full border-2 border-white/80 bg-white/10 backdrop-blur-sm">
                <Play className="ml-0.5 size-4 fill-white text-white" />
              </span>
              Watch Story
            </button>
          </div>

          {/* Phones get the story button in the flow rather than over the photo. */}
          <button
            type="button"
            onClick={() => setStoryOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-[14px] font-semibold text-white lg:hidden"
          >
            <Play className="size-4 fill-white" />
            Watch Story
          </button>
        </div>
      </div>

      <StoryModal open={storyOpen} onClose={() => setStoryOpen(false)} state={state} />
    </>
  );
}
