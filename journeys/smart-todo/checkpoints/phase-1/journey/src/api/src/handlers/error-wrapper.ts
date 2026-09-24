import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AiServiceError } from '../ai/contracts.js';
import type { HandlerDependencies } from './types.js';
import type { ApiHandler } from './types.js';

export type DependencyResolver = () => Promise<HandlerDependencies>;
export type FunctionHandler = (
  request: HttpRequest,
  context: InvocationContext,
) => Promise<HttpResponseInit>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}

export async function handleErrors(
  context: InvocationContext,
  action: () => Promise<HttpResponseInit>,
): Promise<HttpResponseInit> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message);
    if (error instanceof AiServiceError) {
      return errorResponse(503, 'AI_SERVICE_ERROR', 'The AI service could not generate steps.');
    }
    context.error(error);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
}

function errorResponse(status: number, code: string, message: string): HttpResponseInit {
  return { status, jsonBody: { error: { code, message } } };
}

export function withErrorHandling(
  handler: ApiHandler,
  resolveDependencies: DependencyResolver,
): FunctionHandler {
  return async (request, context) => handleErrors(context, async () => {
    const dependencies = await resolveDependencies();
    return handler(request, context, dependencies);
  });
}
