import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type AiRepoModel = {
    schemaVersion: number;
    repository: {
        trackedFileCount: number;
        codeFileCount: number;
        exportedSymbolCount: number;
        contentItemCount: number;
        mechanicCount: number;
        stateFieldCount: number;
        relationshipCount: number;
    };
    files: { id: string; path: string; testedBy: string[] }[];
    symbols: { id: string; file: string; line: number; endLine: number }[];
    content: { id: string; kind: string; expectedMechanicId: string; source: { path: string; line: number | null } }[];
    mechanics: { id: string; evidence: { path: string; line: number | null }[]; tests: { path: string; line: number | null }[] }[];
    relationships: { source: string; target: string; kind: string }[];
    diagnostics: { severity: 'error' | 'warning'; code: string }[];
};

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts', 'ai-repo-model.mjs');
const modelPath = path.join(repoRoot, '.ai', 'repo-model.json');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
};

describe('AI repository model', () => {
    it('is current, source-derived, queryable, and free of diagnostics', () => {
        expect(() =>
            execFileSync(process.execPath, [scriptPath, '--check'], {
                cwd: repoRoot,
                encoding: 'utf8',
                stdio: 'pipe'
            })
        ).not.toThrow();

        const model = JSON.parse(fs.readFileSync(modelPath, 'utf8')) as AiRepoModel;
        expect(model.schemaVersion).toBe(2);
        expect(model.repository.trackedFileCount).toBeGreaterThan(2_000);
        expect(model.repository.codeFileCount).toBeGreaterThan(800);
        expect(model.repository.exportedSymbolCount).toBeGreaterThan(1_000);
        expect(model.repository.contentItemCount).toBeGreaterThan(50);
        expect(model.repository.mechanicCount).toBeGreaterThan(20);
        expect(model.repository.stateFieldCount).toBeGreaterThan(20);
        expect(model.repository.relationshipCount).toBeGreaterThan(2_000);
        expect(model.diagnostics).toEqual([]);
        expect(model.symbols.every((symbol) => symbol.line > 0 && symbol.endLine >= symbol.line)).toBe(true);
        expect(new Set(model.content.map((item) => item.kind))).toEqual(
            new Set(['build_archetype', 'relic', 'findable', 'inventory_item', 'bonus_reward'])
        );
        expect(model.content.map((item) => item.id)).toEqual(
            expect.arrayContaining(['content:relic.peek_charge_plus_one', 'content:findable.scout_glint', 'content:bonus_reward.echo_conduit_lens'])
        );
        expect(model.mechanics.every((mechanic) => mechanic.evidence.length > 0 && mechanic.tests.length > 0)).toBe(true);
        expect(model.relationships.map((edge) => edge.kind)).toEqual(
            expect.arrayContaining(['imports', 'exports', 'declared_by', 'implemented_by', 'tested_by', 'reads', 'writes', 'displays'])
        );
        const mechanicIds = new Set(model.mechanics.map((mechanic) => mechanic.id));
        expect(model.content.filter((item) => !mechanicIds.has(`mechanic:${item.expectedMechanicId}`))).toEqual([]);

        const queryOutput = execFileSync(process.execPath, [scriptPath, '--query', 'recallFocus'], {
            cwd: repoRoot,
            encoding: 'utf8'
        });
        const query = JSON.parse(queryOutput) as { nodes: { id: string }[]; relationships: unknown[] };
        expect(query.nodes.map((node) => node.id)).toContain('state:recallFocus');
        expect(query.relationships.length).toBeGreaterThan(0);
    }, 120_000);

    it('registers model generation and drift checks in the project gates', () => {
        expect(packageJson.scripts['ai:model']).toBe('node scripts/ai-repo-model.mjs --write');
        expect(packageJson.scripts['ai:model:check']).toBe('node scripts/ai-repo-model.mjs --check');
        expect(packageJson.scripts['ai:model:query']).toBe('node scripts/ai-repo-model.mjs --query');
        expect(packageJson.scripts['gate:systems']).toContain('yarn ai:model:check');
    });
});
