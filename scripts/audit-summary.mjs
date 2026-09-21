import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runtime dependencies are the ones that end up inside the package a player installs. Resolved
 * from the working directory, the same assumption `yarn audit` below already makes.
 */
export const readRuntimeDependencyNames = (packageJsonPath = join(process.cwd(), 'package.json')) =>
  new Set(Object.keys(JSON.parse(readFileSync(packageJsonPath, 'utf8')).dependencies ?? {}));

export const parseYarnAuditJsonLines = (stdout) => {
  const advisories = new Map();
  let summary = null;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === 'auditSummary') {
      summary = event.data?.vulnerabilities ?? null;
      continue;
    }

    if (event.type !== 'auditAdvisory') {
      continue;
    }

    const advisory = event.data?.advisory;
    const resolution = event.data?.resolution;
    if (!advisory || !resolution) {
      continue;
    }

    const key = `${advisory.id}:${advisory.module_name}`;
    const current = advisories.get(key) ?? {
      moduleName: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title,
      vulnerableVersions: advisory.vulnerable_versions,
      patchedVersions: advisory.patched_versions,
      paths: new Set(),
    };
    current.paths.add(resolution.path);
    advisories.set(key, current);
  }

  return { advisories, summary };
};

const severityOrder = ['critical', 'high', 'moderate', 'low', 'info'];

export const orderedAuditAdvisories = (advisories) => [...advisories.values()].sort((a, b) => {
  const severityDelta = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return b.paths.size - a.paths.size;
});

export const countAuditVulnerabilities = (summary) =>
  severityOrder.reduce((total, severity) => total + Number(summary?.[severity] ?? 0), 0);

/**
 * The first package in a resolution path is the direct dependency the advisory arrives through.
 * `yarn audit` writes paths as `a>b>c`, so the root is everything before the first `>`.
 */
export const advisoryPathRoot = (path) => String(path).split('>')[0].trim();

/**
 * Does this advisory reach something a player runs, or does it only exist while the game is being
 * built? An advisory under eslint or electron-builder never ships; one under electron-store or
 * pixi.js does. The gate used to fail on any advisory at all, which meant it failed permanently,
 * which meant nobody ran it — and 64 advisories accumulated behind a red light nobody looked at.
 */
export const advisoryReachesRuntime = (advisory, runtimeDependencyNames) =>
  [...advisory.paths].some((path) => runtimeDependencyNames.has(advisoryPathRoot(path)));

export const partitionAdvisoriesByReach = (advisories, runtimeDependencyNames) => {
  const runtime = [];
  const buildOnly = [];
  for (const advisory of orderedAuditAdvisories(advisories)) {
    (advisoryReachesRuntime(advisory, runtimeDependencyNames) ? runtime : buildOnly).push(advisory);
  }
  return { buildOnly, runtime };
};

/**
 * Build-only advisories are tolerated up to a recorded number so the toolchain's own churn does not
 * block gameplay work — but the number is recorded, so it cannot quietly grow. Lower it whenever a
 * bump clears some; raising it is a decision someone has to write down here.
 *
 * Gen 254: 39 → 9. The gate went red at 39 against a baseline of 30, and every one of the nine new
 * groups named a version this repo's own `resolutions` block was pinning — the pins had been
 * correct when they were written and had since been overtaken. Bumping each pin to the version its
 * advisory names as patched (tar, postcss, ip-address, joi, shell-quote, baseline-browser-mapping,
 * the brace-expansion and js-yaml pins, plus vitest, svgo and electron-builder) cleared thirty.
 *
 * The nine that remain are all `brace-expansion`, on three incompatible major lines that different
 * build tools require (`^1` under eslint's pinned minimatch 3.1.5, `^2` under depcheck and jake's
 * filelist, `^5` under rimraf's glob and @electron/universal). A yarn resolution names a path, not
 * a range, so a single `**\/brace-expansion` pin would force one major on all three; the
 * path-specific pins that CAN be written are already here and took. Each is a
 * denial-of-service on crafted input, in a tool that runs on a developer's machine and never in a
 * shipped build. Bump minimatch at those three parents and the number should fall to zero.
 */
export const BUILD_ONLY_ADVISORY_BASELINE = 9;

export const evaluateAuditRisk = ({ advisories }, runtimeDependencyNames, baseline = BUILD_ONLY_ADVISORY_BASELINE) => {
  const { buildOnly, runtime } = partitionAdvisoriesByReach(advisories, runtimeDependencyNames);
  const failures = [];
  if (runtime.length > 0) {
    failures.push(
      `${runtime.length} advisory group(s) reach a shipped build: ${runtime.map((row) => row.moduleName).join(', ')}`,
    );
  }
  if (buildOnly.length > baseline) {
    failures.push(
      `build-only advisories grew from ${baseline} to ${buildOnly.length}; bump the dependency or raise the baseline deliberately`,
    );
  }
  return { buildOnly, failures, runtime };
};

export const formatAuditSummary = ({ advisories, summary }) => {
  const orderedAdvisories = orderedAuditAdvisories(advisories);
  const lines = [
    '# Yarn Audit Summary',
    severityOrder
    .map((severity) => `${severity}: ${summary[severity] ?? 0}`)
    .join(', '),
    `unique advisories: ${advisories.size}`,
  ];

  if (orderedAdvisories.length > 0) {
    lines.push('', '## Remaining Advisory Groups');
    for (const advisory of orderedAdvisories) {
      lines.push(
      `- ${advisory.severity} ${advisory.moduleName}: ${advisory.title} (${advisory.paths.size} path${advisory.paths.size === 1 ? '' : 's'})`,
      );
      lines.push(`  vulnerable: ${advisory.vulnerableVersions}; patched: ${advisory.patchedVersions}`);
      lines.push(`  paths: ${[...advisory.paths].slice(0, 3).join('; ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
};

export const filterAuditStderrLines = (stderr) =>
  stderr
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.includes('No license field') && !trimmed.includes('Resolution field');
    });

export const runAuditSummary = () => {
  const audit = spawnSync('yarn', ['audit', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (audit.stderr.trim()) {
    for (const line of filterAuditStderrLines(audit.stderr)) {
      console.error(line);
    }
  }

  const parsed = parseYarnAuditJsonLines(audit.stdout);
  if (!parsed.summary) {
    console.error('No audit summary was emitted by yarn audit.');
    return audit.status ?? 1;
  }

  process.stdout.write(formatAuditSummary(parsed));

  const risk = evaluateAuditRisk(parsed, readRuntimeDependencyNames());
  process.stdout.write(
    `\nreaching a shipped build: ${risk.runtime.length}; build-only: ${risk.buildOnly.length} (baseline ${BUILD_ONLY_ADVISORY_BASELINE})\n`,
  );
  for (const failure of risk.failures) {
    console.error(`audit gate: ${failure}`);
  }
  return risk.failures.length > 0 ? 1 : 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runAuditSummary();
}
