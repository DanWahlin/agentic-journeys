import type { StepGenerator } from './contracts.js';

export function createFakeStepGenerator(): StepGenerator {
  return {
    async generate(title) {
      return [
        { title: 'Clarify the goal', description: `Define the desired result for "${title}".` },
        { title: 'Gather what you need', description: `Collect the information and tools needed for "${title}".` },
        { title: 'Do the first focused session', description: `Schedule and complete a focused work session for "${title}".` },
        { title: 'Review and wrap up', description: `Review the result of "${title}" and finish any remaining details.` },
      ];
    },
  };
}
