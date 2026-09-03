import { describe, expect, it } from 'vitest';

type ParsedAuditSummary = {
    advisories: Map<string, { paths: Set<string> }>;
    summary: Record<string, number> | null;
};

type AuditAdvisory = {
    moduleName: string;
    paths: Set<string>;
    patchedVersions: string;
    severity: string;
    title: string;
    vulnerableVersions: string;
};

type AuditSummaryModule = {
    advisoryPathRoot: (path: string) => string;
    countAuditVulnerabilities: (summary: Record<string, number> | null) => number;
    evaluateAuditRisk: (
        parsed: { advisories: Map<string, AuditAdvisory> },
        runtimeDependencyNames: Set<string>,
        baseline?: number
    ) => { buildOnly: AuditAdvisory[]; failures: string[]; runtime: AuditAdvisory[] };
    filterAuditStderrLines: (stderr: string) => string[];
    formatAuditSummary: (parsed: ParsedAuditSummary) => string;
    parseYarnAuditJsonLines: (stdout: string) => ParsedAuditSummary;
    partitionAdvisoriesByReach: (
        advisories: Map<string, AuditAdvisory>,
        runtimeDependencyNames: Set<string>
    ) => { buildOnly: AuditAdvisory[]; runtime: AuditAdvisory[] };
    readRuntimeDependencyNames: (packageJsonPath?: string) => Set<string>;
};

const loadAuditSummary = async (): Promise<AuditSummaryModule> => {
    // @ts-expect-error scripts are runtime ESM modules without generated TypeScript declarations.
    return (await import('../../scripts/audit-summary.mjs')) as AuditSummaryModule;
};

const auditLine = (event: unknown): string => JSON.stringify(event);

describe('audit-summary script', () => {
    it('summarizes unique advisories and reports a failing vulnerability count', async () => {
        const { countAuditVulnerabilities, formatAuditSummary, parseYarnAuditJsonLines } = await loadAuditSummary();
        const parsed = parseYarnAuditJsonLines(
            [
                auditLine({
                    type: 'auditAdvisory',
                    data: {
                        resolution: { path: 'tool>package-a' },
                        advisory: {
                            id: 1,
                            module_name: 'package-a',
                            severity: 'high',
                            title: 'Package A issue',
                            vulnerable_versions: '<2.0.0',
                            patched_versions: '>=2.0.0'
                        }
                    }
                }),
                auditLine({
                    type: 'auditAdvisory',
                    data: {
                        resolution: { path: 'other>package-a' },
                        advisory: {
                            id: 1,
                            module_name: 'package-a',
                            severity: 'high',
                            title: 'Package A issue',
                            vulnerable_versions: '<2.0.0',
                            patched_versions: '>=2.0.0'
                        }
                    }
                }),
                auditLine({
                    type: 'auditSummary',
                    data: {
                        vulnerabilities: { critical: 0, high: 2, moderate: 0, low: 0, info: 0 }
                    }
                })
            ].join('\n')
        );

        expect(parsed.advisories.size).toBe(1);
        expect(countAuditVulnerabilities(parsed.summary)).toBe(2);
        expect(formatAuditSummary(parsed)).toContain('unique advisories: 1');
        expect(formatAuditSummary(parsed)).toContain('Package A issue (2 paths)');
    });

    it('reports zero vulnerabilities for a clean audit summary', async () => {
        const { countAuditVulnerabilities, formatAuditSummary, parseYarnAuditJsonLines } = await loadAuditSummary();
        const parsed = parseYarnAuditJsonLines(
            auditLine({
                type: 'auditSummary',
                data: {
                    vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
                }
            })
        );

        expect(countAuditVulnerabilities(parsed.summary)).toBe(0);
        expect(formatAuditSummary(parsed)).toContain('critical: 0, high: 0, moderate: 0, low: 0, info: 0');
    });

    it('keeps real audit stderr while filtering known Yarn warning noise', async () => {
        const { filterAuditStderrLines } = await loadAuditSummary();

        expect(
            filterAuditStderrLines(
                [
                    'warning ..\\..\\..\\package.json: No license field',
                    '{"type":"warning","data":"Resolution field \\"zustand@5.0.12\\" is incompatible with requested version \\"zustand@^4.4.0\\""}',
                    'unexpected audit stderr'
                ].join('\n')
            )
        ).toEqual(['unexpected audit stderr']);
    });
});

describe('audit risk gate', () => {
    const advisory = (moduleName: string, paths: string[]): AuditAdvisory => ({
        moduleName,
        paths: new Set(paths),
        patchedVersions: '>=2',
        severity: 'high',
        title: `${moduleName} is vulnerable`,
        vulnerableVersions: '<2'
    });

    const advisoriesOf = (...rows: ReturnType<typeof advisory>[]) =>
        new Map(rows.map((row, index) => [`${index}:${row.moduleName}`, row]));

    it('reads the direct dependency an advisory arrives through', async () => {
        const { advisoryPathRoot } = await loadAuditSummary();
        expect(advisoryPathRoot('electron-store>conf>ajv>fast-uri')).toBe('electron-store');
        expect(advisoryPathRoot('eslint')).toBe('eslint');
    });

    it('separates what ships from what only builds', async () => {
        const { partitionAdvisoriesByReach } = await loadAuditSummary();
        const runtime = new Set(['pixi.js', 'electron-store']);
        const { buildOnly, runtime: shipped } = partitionAdvisoriesByReach(
            advisoriesOf(
                advisory('xmldom', ['pixi.js>@xmldom/xmldom', 'electron-builder>plist>@xmldom/xmldom']),
                advisory('humanfs', ['eslint>@humanfs/node'])
            ),
            runtime
        );
        expect(shipped.map((row) => row.moduleName)).toEqual(['xmldom']);
        expect(buildOnly.map((row) => row.moduleName)).toEqual(['humanfs']);
    });

    it('fails the moment an advisory reaches a shipped build, whatever the baseline says', async () => {
        const { evaluateAuditRisk } = await loadAuditSummary();
        const risk = evaluateAuditRisk(
            { advisories: advisoriesOf(advisory('fast-uri', ['electron-store>conf>ajv>fast-uri'])) },
            new Set(['electron-store']),
            999
        );
        expect(risk.failures).toHaveLength(1);
        expect(risk.failures[0]).toContain('reach a shipped build');
        expect(risk.failures[0]).toContain('fast-uri');
    });

    it('fails when build-only advisories creep past the recorded baseline', async () => {
        const { evaluateAuditRisk } = await loadAuditSummary();
        const three = advisoriesOf(
            advisory('a', ['eslint>a']),
            advisory('b', ['vite>b']),
            advisory('c', ['depcheck>c'])
        );
        expect(evaluateAuditRisk({ advisories: three }, new Set(['react']), 3).failures).toEqual([]);
        const grown = evaluateAuditRisk({ advisories: three }, new Set(['react']), 2);
        expect(grown.failures).toHaveLength(1);
        expect(grown.failures[0]).toContain('grew from 2 to 3');
    });

    it('passes a build whose advisories are all build-only and within the baseline', async () => {
        const { evaluateAuditRisk } = await loadAuditSummary();
        expect(
            evaluateAuditRisk({ advisories: advisoriesOf(advisory('a', ['eslint>a'])) }, new Set(['react']), 30).failures
        ).toEqual([]);
    });

    it('reads the real runtime dependency list off package.json', async () => {
        const { readRuntimeDependencyNames } = await loadAuditSummary();
        const names = readRuntimeDependencyNames();
        expect(names.has('electron-store')).toBe(true);
        expect(names.has('pixi.js')).toBe(true);
        // Build tooling must not be in there, or the gate would fail on toolchain churn forever.
        expect(names.has('eslint')).toBe(false);
        expect(names.has('electron')).toBe(false);
    });
});
