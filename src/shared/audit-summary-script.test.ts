import { describe, expect, it } from 'vitest';

type ParsedAuditSummary = {
    advisories: Map<string, { paths: Set<string> }>;
    summary: Record<string, number> | null;
};

type AuditSummaryModule = {
    countAuditVulnerabilities: (summary: Record<string, number> | null) => number;
    filterAuditStderrLines: (stderr: string) => string[];
    formatAuditSummary: (parsed: ParsedAuditSummary) => string;
    parseYarnAuditJsonLines: (stdout: string) => ParsedAuditSummary;
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
