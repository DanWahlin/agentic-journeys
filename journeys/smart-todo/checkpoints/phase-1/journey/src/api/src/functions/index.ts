import { app } from '@azure/functions';
import { getStepGenerator } from '../ai/factory.js';
import { getDataStore } from '../data/factory.js';
import { withErrorHandling } from '../handlers/error-wrapper.js';
import { generateSteps, updateStep } from '../handlers/steps.js';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../handlers/todos.js';

const dataProvider = process.env.DATA_PROVIDER;
const aiProvider = process.env.AI_PROVIDER;
if (dataProvider !== 'memory' && dataProvider !== 'sql') {
  throw new Error('DATA_PROVIDER must be set to "memory" or "sql"');
}
const generator = getStepGenerator(aiProvider);
const resolveDependencies = async () => ({
  store: await getDataStore(dataProvider),
  generator,
});

app.http('listTodos', {
  methods: ['GET'],
  route: 'todos',
  authLevel: 'anonymous',
  handler: withErrorHandling(listTodos, resolveDependencies),
});
app.http('createTodo', {
  methods: ['POST'],
  route: 'todos',
  authLevel: 'anonymous',
  handler: withErrorHandling(createTodo, resolveDependencies),
});
app.http('updateTodo', {
  methods: ['PATCH'],
  route: 'todos/{id}',
  authLevel: 'anonymous',
  handler: withErrorHandling(updateTodo, resolveDependencies),
});
app.http('deleteTodo', {
  methods: ['DELETE'],
  route: 'todos/{id}',
  authLevel: 'anonymous',
  handler: withErrorHandling(deleteTodo, resolveDependencies),
});
app.http('generateSteps', {
  methods: ['POST'],
  route: 'todos/{id}/generate-steps',
  authLevel: 'anonymous',
  handler: withErrorHandling(generateSteps, resolveDependencies),
});
app.http('updateStep', {
  methods: ['PATCH'],
  route: 'todos/{id}/steps/{stepId}',
  authLevel: 'anonymous',
  handler: withErrorHandling(updateStep, resolveDependencies),
});
