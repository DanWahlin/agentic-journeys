#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(scriptPath), '..');

function runtimeVersion(identifier) {
  const match = identifier.match(/\.iOS-(\d+)(?:-(\d+))?(?:-(\d+))?$/);
  return match ? match.slice(1).map((part) => Number(part ?? 0)) : [-1];
}

function compareVersionsDescending(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function selectNewestAvailableIPhone(simulatorList) {
  const candidates = Object.entries(simulatorList.devices ?? {})
    .flatMap(([runtime, devices]) =>
      devices
        .filter((device) => device.isAvailable && device.name.startsWith('iPhone'))
        .map((device) => ({
          name: device.name,
          udid: device.udid,
          runtime,
          version: runtimeVersion(runtime),
        })),
    )
    .sort((left, right) => compareVersionsDescending(left.version, right.version));

  return candidates[0] ?? null;
}

export function actionableXcodeLines(output) {
  const lines = output.split(/\r?\n/);
  const compilerErrors = lines.filter((line) =>
    /:\d+:\d+:\s+error:/.test(line),
  );
  const failedTests = lines.filter(
    (line) =>
      /Test [Cc]ase .* failed/.test(line) ||
      /^\s*[✖✘].*\btest\w+/i.test(line),
  );
  return [...new Set([...compilerErrors, ...failedTests])];
}

function testSummary(output, exitCode) {
  const summaries = output.match(/\*\* TEST (?:SUCCEEDED|FAILED) \*\*/g);
  return summaries?.at(-1) ?? `TEST ${exitCode === 0 ? 'SUCCEEDED' : 'FAILED'}`;
}

function commandExists(tool) {
  return spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).status === 0;
}

function runCommand(command, args, options) {
  return spawnSync(command, args, options);
}

export function runIOSGate({
  platform = process.platform,
  hasCommand = commandExists,
  execute = runCommand,
  log = console.log,
  error = console.error,
  projectDir = projectDirectory,
} = {}) {
  if (platform !== 'darwin') {
    log('SKIP: iOS tests require macOS and Xcode');
    return 0;
  }

  for (const tool of ['xcodebuild', 'xcrun']) {
    if (!hasCommand(tool)) {
      error(
        `ERROR: ${tool} is required. Install Xcode from the Mac App Store and run ` +
          '`sudo xcode-select --switch /Applications/Xcode.app`.',
      );
      return 1;
    }
  }

  const simulatorResult = execute(
    'xcrun',
    ['simctl', 'list', 'devices', 'available', '--json'],
    { cwd: projectDir, encoding: 'utf8' },
  );
  if (simulatorResult.status !== 0) {
    error(simulatorResult.stderr?.trim() || 'ERROR: Unable to list iOS simulators.');
    return simulatorResult.status ?? 1;
  }

  let simulatorList;
  try {
    simulatorList = JSON.parse(simulatorResult.stdout);
  } catch (parseError) {
    error(`ERROR: xcrun returned invalid simulator JSON: ${parseError.message}`);
    return 1;
  }

  const destination = selectNewestAvailableIPhone(simulatorList);
  if (!destination) {
    error('ERROR: No available iPhone simulator was found. Install an iOS simulator runtime in Xcode.');
    return 1;
  }

  const runtimeName = destination.runtime
    .replace('com.apple.CoreSimulator.SimRuntime.', '')
    .replaceAll('-', ' ');
  log(`Using ${destination.name} (${runtimeName})`);

  const testResult = execute(
    'xcodebuild',
    [
      'test',
      '-project',
      'src/ios/SmartTodo.xcodeproj',
      '-scheme',
      'SmartTodo',
      '-destination',
      `id=${destination.udid}`,
    ],
    { cwd: projectDir, encoding: 'utf8' },
  );
  const output = [testResult.stdout, testResult.stderr].filter(Boolean).join('\n');
  const exitCode = testResult.status ?? 1;

  log(testSummary(output, exitCode));
  if (exitCode !== 0) {
    for (const line of actionableXcodeLines(output)) {
      error(line);
    }
  }

  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = runIOSGate();
}
