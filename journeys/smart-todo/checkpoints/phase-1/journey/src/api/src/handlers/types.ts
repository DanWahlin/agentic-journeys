import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { StepGenerator } from '../ai/contracts.js';
import type { DataStore } from '../data/contracts.js';

export interface HandlerDependencies {
  store: DataStore;
  generator: StepGenerator;
}

export type ApiHandler = (
  request: HttpRequest,
  context: InvocationContext,
  dependencies: HandlerDependencies,
) => Promise<HttpResponseInit>;
