import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkgPath = resolve(root, 'package.json');

// ── Parse args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const hasVm = args.includes('-vm');
const hasVs = args.includes('-vs');

// ── Read version ──────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);

if (hasVs) {
  major += 1;
  minor = 0;
  patch = 0;
} else if (hasVm) {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const version = `${major}.${minor}.${patch}`;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

// ── Git operations ────────────────────────────────────────────
execSync('git add .', { cwd: root, stdio: 'inherit' });
execSync(`git commit -m "feat: v${version}."`, { cwd: root, stdio: 'inherit' });
execSync('git push', { cwd: root, stdio: 'inherit' });
execSync(`git tag v${version}`, { cwd: root, stdio: 'inherit' });
execSync('git push --tags', { cwd: root, stdio: 'inherit' });

console.log(`Bumped to v${version}`);
