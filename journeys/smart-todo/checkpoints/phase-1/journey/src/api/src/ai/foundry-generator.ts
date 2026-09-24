import OpenAI from 'openai';
import { AiServiceError, type GeneratedStep } from './contracts.js';
import type { StepGenerator } from './contracts.js';
import { parseGeneratedSteps } from './parser.js';

export interface FoundryGeneratorOptions {
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  client?: CompletionClient;
  timeoutMs?: number;
}

interface CompletionClient {
  chat: {
    completions: {
      create(
        body: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ): Promise<{ choices: Array<{ message: { content?: string | null } }> }>;
    };
  };
}

const SYSTEM_PROMPT = `You are a productivity assistant that breaks down goals into actionable steps.

Given a todo item, generate 3-7 concrete, actionable steps to accomplish it.
Each step should be specific enough that someone could start working on it immediately.

Rules:
- Each step title must be under 200 characters
- Each step description must be 1-3 sentences with specific, actionable detail
- Include quantities, time estimates, or specific tools where relevant
- Steps must be in logical order (what to do first, second, etc.)
- Be practical and realistic, not generic or motivational

Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation:
[
  {
    "title": "Short action title",
    "description": "Specific actionable description with details."
  }
]`;

export function normalizeFoundryEndpoint(endpoint: string): string {
  const withoutSlash = endpoint.trim().replace(/\/+$/, '');
  const base = withoutSlash.replace(/\/openai\/v1$/i, '');
  return `${base}/openai/v1/`;
}

export function createFoundryStepGenerator(options: FoundryGeneratorOptions = {}): StepGenerator {
  const endpoint = options.endpoint ?? process.env.AZURE_AI_ENDPOINT ?? '';
  const apiKey = options.apiKey ?? process.env.AZURE_AI_KEY ?? '';
  const deployment = options.deployment ?? process.env.AZURE_AI_DEPLOYMENT ?? 'gpt-5-mini';
  const timeoutMs = options.timeoutMs ?? 30_000;
  const client = options.client ?? (
    endpoint && apiKey
      ? new OpenAI({ baseURL: normalizeFoundryEndpoint(endpoint), apiKey })
      : undefined
  );

  async function attempt(title: string, retry: boolean): Promise<GeneratedStep[]> {
    if (!client) throw new AiServiceError('Foundry endpoint and API key are required');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await client.chat.completions.create({
        model: deployment,
        messages: retry
          ? [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: title },
              { role: 'user', content: 'Your previous response was not valid JSON. Return ONLY a JSON array.' },
            ]
          : [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: title },
            ],
        max_completion_tokens: 1500,
      }, { signal: controller.signal });
      return parseGeneratedSteps(response.choices[0]?.message.content ?? '');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async generate(title) {
      try {
        return await attempt(title, false);
      } catch {
        try {
          return await attempt(title, true);
        } catch (error) {
          throw new AiServiceError('The AI service could not generate valid steps', { cause: error });
        }
      }
    },
  };
}
