export interface GeneratedStep {
  title: string;
  description: string;
}

export interface StepGenerator {
  generate(title: string): Promise<GeneratedStep[]>;
}

export class AiServiceError extends Error {
  override name = 'AiServiceError';
}
