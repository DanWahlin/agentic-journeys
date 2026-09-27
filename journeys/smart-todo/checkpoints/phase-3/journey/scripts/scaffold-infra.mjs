#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const sourceProject = realpathSync(path.resolve(path.dirname(scriptPath), '..'));
const appNamePattern = /^[a-z][a-z0-9-]{2,30}$/;

function usage() {
  return 'Usage: node scripts/scaffold-infra.mjs --target <directory> --name <app-name>';
}

function parseArguments(arguments_) {
  const values = {};

  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index];
    const value = arguments_[index + 1];
    if (!['--target', '--name'].includes(option) || !value) {
      throw new Error(usage());
    }
    if (Object.hasOwn(values, option)) {
      throw new Error(`Duplicate option: ${option}`);
    }
    values[option] = value;
  }

  if (!values['--target'] || !values['--name']) {
    throw new Error(usage());
  }

  return {
    target: path.resolve(values['--target']),
    name: values['--name'],
  };
}

function resolvedPath(target) {
  const missingSegments = [];
  let existingPath = target;

  while (!existsSync(existingPath)) {
    const parent = path.dirname(existingPath);
    if (parent === existingPath) break;
    missingSegments.unshift(path.basename(existingPath));
    existingPath = parent;
  }

  return path.join(realpathSync(existingPath), ...missingSegments);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateTarget(target) {
  const canonicalTarget = resolvedPath(target);
  if (isInside(sourceProject, canonicalTarget)) {
    throw new Error('Target must not be the source project or a directory inside it.');
  }

  if (!existsSync(target)) return;
  if (!statSync(target).isDirectory()) {
    throw new Error('Target exists and is not a directory.');
  }
  if (readdirSync(target).length > 0) {
    throw new Error('Target exists and is not empty.');
  }
}

function isExcluded(relativePath, sourcePath) {
  const segments = relativePath.split(path.sep);
  const basename = path.basename(relativePath);
  if (segments.includes('.azure') || segments.includes('node_modules')) return true;
  if (basename === '.env' || basename.startsWith('.env.')) return true;

  if (basename.endsWith('.json')) {
    const bicepSource = sourcePath.slice(0, -'.json'.length) + '.bicep';
    return existsSync(bicepSource);
  }

  return false;
}

function copyTree(sourceDirectory, targetDirectory, rootDirectory, copiedFiles) {
  mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const relativePath = path.relative(rootDirectory, sourcePath);
    if (isExcluded(relativePath, sourcePath)) continue;

    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath, rootDirectory, copiedFiles);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
      copiedFiles.push(relativePath);
    } else {
      throw new Error(`Refusing to copy unsupported file type: ${relativePath}`);
    }
  }
}

function replaceAzureYamlName(source, appName) {
  let nameReplacements = 0;
  let templateReplacements = 0;
  const updated = source
    .replace(/^name:\s*.*$/m, () => {
      nameReplacements += 1;
      return `name: ${appName}`;
    })
    .replace(/^(\s*template:\s*)[^@\s]+(@.*)$/m, (_, prefix, suffix) => {
      templateReplacements += 1;
      return `${prefix}${appName}${suffix}`;
    });

  if (nameReplacements !== 1 || templateReplacements !== 1) {
    throw new Error('azure.yaml must contain one top-level name and one metadata.template value.');
  }
  return updated;
}

try {
  const { target, name } = parseArguments(process.argv.slice(2));
  if (!appNamePattern.test(name)) {
    throw new Error('App name must match ^[a-z][a-z0-9-]{2,30}$.');
  }
  validateTarget(target);

  const copiedFiles = [];
  mkdirSync(target, { recursive: true });
  copyTree(
    path.join(sourceProject, 'infra'),
    path.join(target, 'infra'),
    sourceProject,
    copiedFiles,
  );

  const azureYaml = replaceAzureYamlName(
    readFileSync(path.join(sourceProject, 'azure.yaml'), 'utf8'),
    name,
  );
  writeFileSync(path.join(target, 'azure.yaml'), azureYaml);
  copiedFiles.push('azure.yaml');

  const scriptsDirectory = path.join(target, 'scripts');
  mkdirSync(scriptsDirectory, { recursive: true });
  copyFileSync(
    path.join(sourceProject, 'scripts', 'check-infra.mjs'),
    path.join(scriptsDirectory, 'check-infra.mjs'),
  );
  copiedFiles.push(path.join('scripts', 'check-infra.mjs'));

  console.log('Copied files:');
  for (const copiedFile of copiedFiles.sort()) {
    console.log(`- ${copiedFile.split(path.sep).join('/')}`);
  }
  console.log('\nNext steps:');
  console.log('1. Add the API under src/api.');
  console.log('2. Run node scripts/check-infra.mjs --offline.');
  console.log('3. Set AZURE_AI_MODEL_VERSION for the selected region and the other azd environment values.');
  console.log('4. Deploy only after the full infrastructure gate passes.');
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
