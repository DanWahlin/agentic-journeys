#!/usr/bin/env node
// Keeps an OIDC Azure CLI sign-in fresh inside a GitHub Actions job.
//
// azure/login signs the Azure CLI in with GitHub's short-lived OIDC token, and the CLI keeps
// reusing that token whenever it needs a new access token. Once it expires (minutes), new
// requests fail with AADSTS700024, while cached tokens keep working, so long journeys break
// partway through. This loop signs in again with a fresh GitHub token every few minutes.
//
// It runs only when ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN,
// AZURE_CLIENT_ID, and AZURE_TENANT_ID are set, and never prints the token.
// Usage: node refresh-azure-oidc.mjs [--interval-minutes 4] [--once]

import { spawnSync } from 'node:child_process';

const { ACTIONS_ID_TOKEN_REQUEST_URL: url, ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken, AZURE_CLIENT_ID: clientId, AZURE_TENANT_ID: tenantId, AZURE_SUBSCRIPTION_ID: subscriptionId } = process.env;
const args = process.argv.slice(2);
const intervalMinutes = Number(args[args.indexOf('--interval-minutes') + 1] || 4);

if (!url || !requestToken || !clientId || !tenantId) {
  console.log('refresh-azure-oidc: not running in a GitHub Actions OIDC job; nothing to do');
  process.exit(0);
}

function az(azArgs) {
  // az is az.cmd on Windows. A JWT holds only base64url characters and dots, so it's safe on a cmd line.
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? ['az', ...azArgs].join(' ') : 'az', windows ? [] : azArgs, { shell: windows, encoding: 'utf8' });
  return result.status;
}

async function refresh() {
  const response = await fetch(`${url}&audience=${encodeURIComponent('api://AzureADTokenExchange')}`, { headers: { authorization: `bearer ${requestToken}` } });
  if (!response.ok) throw new Error(`GitHub OIDC token request returned HTTP ${response.status}`);
  const { value } = await response.json();
  const login = az(['login', '--service-principal', '--username', clientId, '--tenant', tenantId, '--federated-token', value, '--allow-no-subscriptions', '--output', 'none']);
  if (login !== 0) throw new Error(`az login exited ${login}`);
  if (subscriptionId) az(['account', 'set', '--subscription', subscriptionId]);
  console.log(`refresh-azure-oidc: refreshed at ${new Date().toISOString()}`);
}

do {
  try { await refresh(); } catch (error) { console.log(`refresh-azure-oidc: ${error.message}`); }
  if (args.includes('--once')) break;
  await new Promise((resolve) => setTimeout(resolve, intervalMinutes * 60000));
} while (true);
