import { spawnSync } from 'node:child_process';

const audit = spawnSync('yarn', ['audit', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const advisories = new Map();
let summary = null;

for (const line of audit.stdout.split(/\r?\n/)) {
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

if (audit.stderr.trim()) {
  for (const line of audit.stderr.trim().split(/\r?\n/)) {
    if (!line.includes('No license field')) {
      console.error(line);
    }
  }
}

if (!summary) {
  console.error('No audit summary was emitted by yarn audit.');
  process.exit(audit.status ?? 1);
}

const severityOrder = ['critical', 'high', 'moderate', 'low', 'info'];
const orderedAdvisories = [...advisories.values()].sort((a, b) => {
  const severityDelta = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return b.paths.size - a.paths.size;
});

console.log('# Yarn Audit Summary');
console.log(
  severityOrder
    .map((severity) => `${severity}: ${summary[severity] ?? 0}`)
    .join(', '),
);
console.log(`unique advisories: ${advisories.size}`);

if (orderedAdvisories.length > 0) {
  console.log('\n## Remaining Advisory Groups');
  for (const advisory of orderedAdvisories) {
    console.log(
      `- ${advisory.severity} ${advisory.moduleName}: ${advisory.title} (${advisory.paths.size} path${advisory.paths.size === 1 ? '' : 's'})`,
    );
    console.log(`  vulnerable: ${advisory.vulnerableVersions}; patched: ${advisory.patchedVersions}`);
    console.log(`  paths: ${[...advisory.paths].slice(0, 3).join('; ')}`);
  }
}
