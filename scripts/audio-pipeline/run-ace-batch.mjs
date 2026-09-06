#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Sibling checkout by default; CROSS_REPO_LIBS_ROOT overrides it (git worktrees live under .claude/worktrees/).
const crossRepoLibsRoot = process.env.CROSS_REPO_LIBS_ROOT?.trim()
    ? path.resolve(process.env.CROSS_REPO_LIBS_ROOT)
    : path.resolve(repoRoot, '..', 'cross-repo-libs');
const runner = path.resolve(crossRepoLibsRoot, 'packages', 'ai-music', 'scripts', 'run-ace-batch.mjs');

const result = spawnSync(process.execPath, [runner, ...process.argv.slice(2)], {
    cwd: repoRoot,
    env: {
        ...process.env,
        CROSS_AI_REPO_ROOT: repoRoot
    },
    stdio: 'inherit',
    shell: false
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
