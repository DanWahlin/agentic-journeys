#!/usr/bin/env node
// SmartTodo black-box contract verifier.
// Local:    node verify-smart-todo.mjs --base-url http://localhost:7071
// Deployed: node verify-smart-todo.mjs            (reads API_URL through azd)
import { asArray, azdValue, fail, jsonRequest, main, request } from './_utils.mjs';

function resolveBaseUrl(argv) {
  const index = argv.indexOf('--base-url');
  if (index === -1) return azdValue('API_URL');
  const value = argv[index + 1];
  if (!value || !/^https?:\/\/[^\s]+$/i.test(value)) fail('--base-url requires an http:// or https:// URL');
  return value.replace(/\/$/, '');
}

async function expectError(url, options, status, code) {
  const response = await request(url, options);
  const text = await response.text();
  if (response.status !== status) fail(`${options.method ?? 'GET'} ${url} returned HTTP ${response.status}, expected ${status}: ${text.slice(0, 300)}`);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`${url} error response was not JSON: ${text.slice(0, 300)}`);
  }
  if (body?.error?.code !== code || typeof body?.error?.message !== 'string') {
    fail(`${url} expected error envelope { error: { code: "${code}", message } }, received ${text.slice(0, 300)}`);
  }
}

function stepsFrom(payload) {
  const direct = asArray(payload, ['steps']);
  return direct.length ? direct : asArray(payload?.todo, ['steps']);
}

main(async () => {
  console.log('=== verify-smart-todo ===');
  const api = resolveBaseUrl(process.argv.slice(2));
  console.log(`Target: ${api}`);
  const listUrl = `${api}/api/todos?userId=user-1`;
  const json = { 'content-type': 'application/json' };

  const { data: initial } = await jsonRequest(listUrl);
  if (asArray(initial).length === 0) fail('Seed todo list is empty');

  await expectError(`${api}/api/todos`, { method: 'GET' }, 400, 'VALIDATION_ERROR');
  await expectError(`${api}/api/todos`, { method: 'POST', headers: json, body: JSON.stringify({ title: '   ', userId: 'user-1' }) }, 400, 'VALIDATION_ERROR');
  await expectError(`${api}/api/todos/verifier-missing-id`, { method: 'PATCH', headers: json, body: JSON.stringify({ title: 'x' }) }, 404, 'NOT_FOUND');

  let todoId;
  try {
    const { data: created } = await jsonRequest(`${api}/api/todos`, {
      method: 'POST', headers: json, body: JSON.stringify({ title: 'Portable verifier smoke test', userId: 'user-1' }),
    }, [201]);
    todoId = created?.id;
    if (!todoId) fail('Create response did not include an id');
    if (created.status !== 'pending' || created.stepsGenerated !== false) fail('New todo must start as pending with stepsGenerated false');

    const { data: generated } = await jsonRequest(`${api}/api/todos/${todoId}/generate-steps`, { method: 'POST', timeoutMs: 120000 });
    const steps = stepsFrom(generated);
    if (steps.length < 3 || steps.length > 7) fail(`Expected 3-7 generated steps, received ${steps.length}`);
    if (steps.some((step) => !step?.id || !step?.title || !step?.description)) fail('Every generated step needs id, title, and description');

    for (const step of steps) {
      const { data: updated } = await jsonRequest(`${api}/api/todos/${todoId}/steps/${step.id}`, {
        method: 'PATCH', headers: json, body: JSON.stringify({ isCompleted: true }),
      });
      if (updated?.isCompleted !== true) fail(`Step ${step.id} did not persist isCompleted: true`);
    }
    const { data: afterComplete } = await jsonRequest(listUrl);
    const completed = asArray(afterComplete).find((todo) => todo.id === todoId);
    if (!completed) fail('Created todo could not be fetched from the user list');
    if (completed.status !== 'completed') fail(`Completing every step must set the todo to completed, found ${completed.status}`);

    await jsonRequest(`${api}/api/todos/${todoId}/steps/${steps[0].id}`, {
      method: 'PATCH', headers: json, body: JSON.stringify({ isCompleted: false }),
    });
    const { data: afterUncheck } = await jsonRequest(listUrl);
    const reopened = asArray(afterUncheck).find((todo) => todo.id === todoId);
    if (reopened?.status !== 'in_progress') fail(`Unchecking a step on a completed todo must set in_progress, found ${reopened?.status}`);
  } finally {
    if (todoId) {
      const deletion = await request(`${api}/api/todos/${todoId}`, { method: 'DELETE', timeoutMs: 60000 });
      if (deletion.status !== 204) fail(`Cleanup delete returned HTTP ${deletion.status}`);
    }
  }
  const { data: finalList } = await jsonRequest(listUrl);
  if (asArray(finalList).some((todo) => todo.id === todoId)) fail('Deleted verifier todo is still present');
  console.log('PASS: seed, validation errors, create, AI steps, auto-completion, reopen, delete, and final absence');
});
