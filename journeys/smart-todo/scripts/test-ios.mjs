#!/usr/bin/env node
// Runs the SmartTodo iOS tests on a simulator. Add --check-starter to also prove
// that the starter project's tests are still present and unchanged in src/ios.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    /:\d+(?::\d+)?:\s+error:/.test(line),
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

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

// Every test file that came with starter/ios must still exist, unchanged, in src/ios.
export function changedStarterTests(projectDir = projectDirectory) {
  const changed = [];
  for (const target of ['SmartTodoTests', 'SmartTodoUITests']) {
    const starterDir = path.join(projectDir, 'starter', 'ios', target);
    if (!existsSync(starterDir)) continue;
    for (const starterFile of listFiles(starterDir)) {
      const relative = path.relative(path.join(projectDir, 'starter', 'ios'), starterFile);
      const copy = path.join(projectDir, 'src', 'ios', relative);
      if (!existsSync(copy)) {
        changed.push(`${relative} (missing)`);
      } else if (!readFileSync(copy).equals(readFileSync(starterFile))) {
        changed.push(`${relative} (changed)`);
      }
    }
  }
  return changed;
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
  checkStarter = false,
} = {}) {
  if (checkStarter) {
    const changed = changedStarterTests(projectDir);
    if (changed.length > 0) {
      for (const file of changed) error(`FAIL starter test ${file}: restore it from starter/ios`);
      return 1;
    }
    log('PASS starter tests are unchanged');
  }

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
  process.exitCode = runIOSGate({ checkStarter: process.argv.includes('--check-starter') });
}
