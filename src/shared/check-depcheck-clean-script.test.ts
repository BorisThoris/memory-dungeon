import { describe, expect, it } from 'vitest';

type DepcheckIssues = {
    dependencies: string[];
    devDependencies: string[];
    missing: Record<string, string[]>;
    invalidFiles: Record<string, string>;
    invalidDirs: Record<string, string>;
};

type CheckDepcheckCleanModule = {
    formatDepcheckIssues: (issues: DepcheckIssues) => string;
    getDepcheckIssues: (payload: Partial<DepcheckIssues>) => DepcheckIssues;
    hasDepcheckIssues: (issues: DepcheckIssues) => boolean;
};

const loadCheckDepcheckClean = async (): Promise<CheckDepcheckCleanModule> => {
    // @ts-expect-error scripts are runtime ESM modules without generated TypeScript declarations.
    return (await import('../../scripts/check-depcheck-clean.mjs')) as CheckDepcheckCleanModule;
};

describe('check-depcheck-clean script', () => {
    it('treats an empty depcheck payload as clean', async () => {
        const { getDepcheckIssues, hasDepcheckIssues } = await loadCheckDepcheckClean();
        const issues = getDepcheckIssues({});

        expect(issues).toEqual({
            dependencies: [],
            devDependencies: [],
            missing: {},
            invalidFiles: {},
            invalidDirs: {}
        });
        expect(hasDepcheckIssues(issues)).toBe(false);
    });

    it('reports every depcheck issue bucket instead of only unused dependencies', async () => {
        const { formatDepcheckIssues, getDepcheckIssues, hasDepcheckIssues } = await loadCheckDepcheckClean();
        const issues = getDepcheckIssues({
            dependencies: ['unused-runtime'],
            devDependencies: ['unused-dev'],
            missing: { react: ['src/App.tsx'] },
            invalidFiles: { 'bad.ts': 'Cannot parse' },
            invalidDirs: { missing: 'Cannot read' }
        });

        expect(hasDepcheckIssues(issues)).toBe(true);
        expect(formatDepcheckIssues(issues)).toContain('unused-runtime');
        expect(formatDepcheckIssues(issues)).toContain('src/App.tsx');
        expect(formatDepcheckIssues(issues)).toContain('Cannot parse');
        expect(formatDepcheckIssues(issues)).toContain('Cannot read');
    });

    it('can be imported without running the CLI path', async () => {
        await expect(loadCheckDepcheckClean()).resolves.toEqual(
            expect.objectContaining({
                formatDepcheckIssues: expect.any(Function),
                getDepcheckIssues: expect.any(Function),
                hasDepcheckIssues: expect.any(Function)
            })
        );
    });
});
