#!/usr/bin/env bash
# Run as a script, never source this file into an interactive terminal.
set -euo pipefail
deployment_repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$deployment_repo"
command -v node >/dev/null
command -v rg >/dev/null
if [[ "${1:-}" == "--install" ]]; then
  npm ci --ignore-scripts
elif [[ "${1:-}" != "" ]]; then
  echo "Usage: bash scripts/deploy-local-mcp.sh [--install]" >&2
  exit 2
fi
npm run build
node --check dist/index.js
node --input-type=module - <<'JS'
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const sourceFiles = execFileSync('git', ['ls-files', '-z', 'src', 'package.json', 'package-lock.json', 'tsconfig.json']).toString().split('\0').filter(Boolean).sort();
const hash = crypto.createHash('sha256');
for (const file of sourceFiles) hash.update(file + '\0').update(fs.readFileSync(file));
const stamp = { builtAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), sourceSha256: hash.digest('hex'), node: process.version };
fs.writeFileSync('dist/.local-build.json', JSON.stringify(stamp, null, 2) + '\n');
console.log('Persistent deployment built at ' + process.cwd() + '/dist/index.js');
JS
