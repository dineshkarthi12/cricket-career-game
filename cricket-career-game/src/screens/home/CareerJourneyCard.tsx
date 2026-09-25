import { Card, CardHeader, Stepper } from '@/components';
import { careerSteps } from '@/lib/selectors';
import { TOTAL_CAREER_STAGES } from '@/data/stages';
import type { GameState } from '@/types';

/** The 20-stage path, with the crowned retirement node on the end. */
export function CareerJourneyCard({ state }: { state: GameState }) {
  return (
    <Card>
      <CardHeader
        title="Your Career Journey"
        titleSuffix={`(${TOTAL_CAREER_STAGES} Stages)`}
        action={{ label: 'View Full Path', to: '/career' }}
        className="mb-3"
      />
      <Stepper steps={careerSteps(state)} endLabel="Retirement" />
    </Card>
  );
}
