#!/usr/bin/env node
// Emit a slim package.json for the backend deploy artifact.
//
// The monorepo's root package.json carries every frontend dep (Kendo UI,
// Angular, wallet adapters, etc). Shipping that into the backend artifact
// makes `npm ci` on the server install 2000+ packages — including ones
// that need libudev or invoke Kendo's license-activation postinstall, and
// transitives like buffer-equal-constant-time that crash on Node 24+.
//
// The backend's actual runtime deps are tiny. This script picks them out
// of the root package.json (preserving the resolved versions) and writes a
// minimal package.json into dist/apps/backend/. A fresh lockfile is then
// generated via `npm install --package-lock-only` so the server can run
// `npm ci --omit=dev` reproducibly.
//
// If you add a new direct import in apps/backend or apps/shared, add it
// to BACKEND_RUNTIME_DEPS below.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_RUNTIME_DEPS = [
  '@nestjs/common',
  '@nestjs/config',
  '@nestjs/core',
  '@nestjs/schedule',
  '@nestjs/serve-static',
  '@nestjs/swagger',
  'axios',
  'ethers',
  'express',
  'joi',
  'node-cache',
  'papaparse',
  'reflect-metadata',
  'rxjs',
  'swagger-ui-express',
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'dist/apps/backend');

const root = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

const missing = BACKEND_RUNTIME_DEPS.filter((d) => !root.dependencies[d]);
if (missing.length) {
  throw new Error(`Missing in root package.json: ${missing.join(', ')}`);
}

const slim = {
  name: 'haushoppe-backend',
  version: root.version,
  private: true,
  scripts: { start: 'node main.js' },
  dependencies: Object.fromEntries(
    BACKEND_RUNTIME_DEPS.map((d) => [d, root.dependencies[d]]),
  ),
};

writeFileSync(resolve(OUT_DIR, 'package.json'), JSON.stringify(slim, null, 2) + '\n');

execSync('npm install --package-lock-only --silent --no-audit --no-fund', {
  cwd: OUT_DIR,
  stdio: 'inherit',
});

console.log(`✓ slim package.json (${BACKEND_RUNTIME_DEPS.length} deps) + lockfile written to ${OUT_DIR}`);
