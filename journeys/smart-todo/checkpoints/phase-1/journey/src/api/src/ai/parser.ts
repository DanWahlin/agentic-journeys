import type { GeneratedStep } from './contracts.js';

export function parseGeneratedSteps(_content: string): GeneratedStep[] {
  let content = _content.trim();
  const fence = content.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) content = fence[1].trim();

  try {
    const value: unknown = JSON.parse(content);
    if (!Array.isArray(value) || value.length < 3) throw new Error();
    const steps = value.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') throw new Error();
      const { title, description } = candidate as Record<string, unknown>;
      if (typeof title !== 'string' || typeof description !== 'string') throw new Error();
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      if (!trimmedTitle || trimmedTitle.length > 200 || !trimmedDescription || trimmedDescription.length > 1000) {
        throw new Error();
      }
      return { title: trimmedTitle, description: trimmedDescription };
    });
    return steps.slice(0, 7);
  } catch {
    throw new Error('Invalid generated steps');
  }
}
