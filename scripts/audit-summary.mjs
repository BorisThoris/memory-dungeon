import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  return countAuditVulnerabilities(parsed.summary) > 0 ? 1 : 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runAuditSummary();
}
