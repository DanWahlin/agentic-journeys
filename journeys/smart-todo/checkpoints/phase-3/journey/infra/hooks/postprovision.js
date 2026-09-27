#!/usr/bin/env node

'use strict';

const { spawnSync } = require('node:child_process');
const https = require('node:https');
const path = require('node:path');

const WINDOWS_CLI_RUNNER = [
  "$ErrorActionPreference = 'Stop'",
  '$payload = ConvertFrom-Json -InputObject $env:AZURE_NATIVE_CLI_PAYLOAD',
  '$command = [string]$payload[0]',
  '$arguments = @($payload | Select-Object -Skip 1)',
  '$resolved = Get-Command -Name $command -ErrorAction Stop',
  '$target = [string]$resolved.Source',
  'if (-not $target) { $target = $command }',
  'foreach ($argument in $arguments) { if (([string]$argument).Contains([char]34)) { [Console]::Error.WriteLine("Arguments containing double quotes cannot be passed safely through Windows PowerShell."); exit 2 } }',
  'if ($target.EndsWith(".cmd", [System.StringComparison]::OrdinalIgnoreCase) -or $target.EndsWith(".bat", [System.StringComparison]::OrdinalIgnoreCase)) {',
  "  $unsafe = [char[]]'&|<>^%!()'",
  '  foreach ($argument in $arguments) { $text = [string]$argument; if ($text.IndexOfAny($unsafe) -ge 0 -or $text.Contains([char]10) -or $text.Contains([char]13)) { [Console]::Error.WriteLine("Arguments containing shell metacharacters or control characters cannot be passed safely to a Windows .cmd/.bat shim."); exit 2 } }',
  '}',
  '& $target @arguments',
  '$ok = $?',
  '$code = $LASTEXITCODE',
  'if ($null -ne $code) { exit $code }',
  'if (-not $ok) { exit 1 }',
].join('; ');

function invocation(command, args) {
  if (process.platform !== 'win32') {
    return { command, args, env: process.env };
  }
  return {
    command: 'powershell.exe',
    args: [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      WINDOWS_CLI_RUNNER,
    ],
    env: {
      ...process.env,
      AZURE_NATIVE_CLI_PAYLOAD: JSON.stringify([command, ...args]),
    },
  };
}

function sanitizedError(result) {
  return [result.stderr, result.error?.message]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function run(command, args, options = {}) {
  const call = invocation(command, args);
  const result = spawnSync(call.command, call.args, {
    encoding: 'utf8',
    env: call.env,
    input: options.input,
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${options.step || command} failed: ${sanitizedError(result) || `exit ${result.status}`}`,
    );
  }
  return result;
}

function output(result) {
  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function checkTool(command, args) {
  return run(command, args, { allowFailure: true }).status === 0;
}

function envValue(name) {
  const value = output(
    run('azd', ['env', 'get-value', name], {
      step: `Read ${name}`,
    }),
  );
  if (!value) throw new Error(`Read ${name} failed: value is empty`);
  return value;
}

function normalizeSqlServer(value) {
  const suffix = '.database.windows.net';
  const shortName = value.toLowerCase().endsWith(suffix)
    ? value.slice(0, -suffix.length)
    : value;
  if (!/^[a-z0-9-]+$/i.test(shortName)) {
    throw new Error('SQL server name is invalid');
  }
  return {
    shortName,
    fqdn: `${shortName}${suffix}`,
  };
}

function validateGuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('SQL identity client ID is not a valid GUID');
  }
}

function sqlIdentifier(value) {
  if (!value || value.length > 128 || /[\u0000-\u001f]/.test(value)) {
    throw new Error('SQL identity name is invalid');
  }
  return value.replaceAll(']', ']]');
}

function publicIp() {
  return new Promise((resolve, reject) => {
    const request = https.get('https://api.ipify.org', { timeout: 15000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        const value = body.trim();
        if (response.statusCode !== 200 || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
          reject(new Error('Resolve public IP failed'));
          return;
        }
        resolve(value);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Resolve public IP timed out')));
    request.on('error', reject);
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tools = [
    ['node', ['--version']],
    ['az', ['version']],
    ['azd', ['version']],
    ['sqlcmd', ['--version']],
  ];

  if (dryRun) console.log('DRY RUN');
  const availability = tools.map(([command, args]) => [
    command,
    checkTool(command, args),
  ]);
  for (const [command, found] of availability) {
    if (dryRun) console.log(`${command}: ${found ? 'FOUND' : 'MISSING'}`);
  }
  if (dryRun) {
    console.log('Would read azd outputs, temporarily allow this host, grant SQL roles, and clean up.');
    return;
  }

  const missing = availability.filter(([, found]) => !found).map(([command]) => command);
  if (missing.length > 0) {
    throw new Error(`Prerequisite check failed: missing ${missing.join(', ')}`);
  }

  const resourceGroup = envValue('RESOURCE_GROUP_NAME');
  const server = normalizeSqlServer(envValue('SQL_SERVER_NAME'));
  const databaseName = envValue('SQL_DATABASE_NAME');
  envValue('FUNCTION_APP_NAME');
  const identityName = envValue('SQL_IDENTITY_NAME');
  const identityClientId = envValue('SQL_IDENTITY_CLIENT_ID');
  validateGuid(identityClientId);
  const escapedIdentityName = sqlIdentifier(identityName);
  const escapedIdentityLiteral = identityName.replaceAll("'", "''");
  const rulePrefix = 'SmartTodoSetup-';
  const ruleName = `${rulePrefix}${Date.now()}`;
  let originalPolicy = '';
  let policyChanged = false;
  let firewallCleanupRequired = false;
  let setupError;

  try {
    originalPolicy = output(
      run(
        'az',
        [
          'sql', 'server', 'conn-policy', 'show',
          '--resource-group', resourceGroup,
          '--server', server.shortName,
          '--query', 'connectionType',
          '--output', 'tsv',
        ],
        { step: 'Read SQL connection policy' },
      ),
    );
    if (originalPolicy === 'Redirect') {
      run(
        'az',
        [
          'sql', 'server', 'conn-policy', 'update',
          '--resource-group', resourceGroup,
          '--server', server.shortName,
          '--connection-type', 'Proxy',
          '--output', 'none',
        ],
        { step: 'Set SQL connection policy to Proxy' },
      );
      policyChanged = true;
    }

    const staleRules = JSON.parse(
      output(
        run(
          'az',
          [
            'sql', 'server', 'firewall-rule', 'list',
            '--resource-group', resourceGroup,
            '--server', server.shortName,
            '--query', `[?starts_with(name, '${rulePrefix}')].name`,
            '--output', 'json',
          ],
          { step: 'List stale temporary firewall rules' },
        ),
      ) || '[]',
    );
    for (const staleRule of staleRules) {
      run(
        'az',
        [
          'sql', 'server', 'firewall-rule', 'delete',
          '--resource-group', resourceGroup,
          '--server', server.shortName,
          '--name', staleRule,
          '--output', 'none',
        ],
        { step: 'Delete stale temporary firewall rule' },
      );
    }

    const ipAddress = await publicIp();
    firewallCleanupRequired = true;
    run(
      'az',
      [
        'sql', 'server', 'firewall-rule', 'create',
        '--resource-group', resourceGroup,
        '--server', server.shortName,
        '--name', ruleName,
        '--start-ip-address', ipAddress,
        '--end-ip-address', ipAddress,
        '--output', 'none',
      ],
      { step: 'Create temporary firewall rule' },
    );

    const sql = [
      `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${escapedIdentityLiteral}')`,
      'BEGIN',
      `  DECLARE @sid varchar(34) = CONVERT(varchar(34), CAST(CAST(N'${identityClientId}' AS uniqueidentifier) AS varbinary(16)), 1);`,
      `  EXEC (N'CREATE USER [${escapedIdentityName}] WITH SID = ' + @sid + N', TYPE = E;');`,
      'END',
      `IF IS_ROLEMEMBER(N'db_datareader', N'${escapedIdentityLiteral}') <> 1`,
      `  ALTER ROLE db_datareader ADD MEMBER [${escapedIdentityName}];`,
      `IF IS_ROLEMEMBER(N'db_datawriter', N'${escapedIdentityLiteral}') <> 1`,
      `  ALTER ROLE db_datawriter ADD MEMBER [${escapedIdentityName}];`,
      `IF IS_ROLEMEMBER(N'db_ddladmin', N'${escapedIdentityLiteral}') <> 1`,
      `  ALTER ROLE db_ddladmin ADD MEMBER [${escapedIdentityName}];`,
    ].join('\n');
    run(
      'sqlcmd',
      [
        '-S', server.fqdn,
        '-d', databaseName,
        '--authentication-method', 'ActiveDirectoryAzCli',
        '-b',
        '-Q', sql,
      ],
      { step: 'Grant SQL managed identity access' },
    );
  } catch (error) {
    setupError = error;
  } finally {
    const cleanupErrors = [];
    if (firewallCleanupRequired) {
      try {
        run(
          'az',
          [
            'sql', 'server', 'firewall-rule', 'delete',
            '--resource-group', resourceGroup,
            '--server', server.shortName,
            '--name', ruleName,
            '--output', 'none',
          ],
          { step: 'Delete temporary firewall rule' },
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (policyChanged) {
      try {
        run(
          'az',
          [
            'sql', 'server', 'conn-policy', 'update',
            '--resource-group', resourceGroup,
            '--server', server.shortName,
            '--connection-type', originalPolicy,
            '--output', 'none',
          ],
          { step: 'Restore SQL connection policy' },
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (setupError) {
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [setupError, ...cleanupErrors],
          `${setupError.message}; cleanup also failed: ${cleanupErrors.map((error) => error.message).join('; ')}`,
        );
      }
      throw setupError;
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        `Cleanup failed: ${cleanupErrors.map((error) => error.message).join('; ')}`,
      );
    }
  }

  console.log('Post-provision SQL setup complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
