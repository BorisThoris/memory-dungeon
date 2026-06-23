import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

type SystemDiagramPayload = {
    actions: {
        id: string;
        priority: string;
        system: string;
        title: string;
        detail: string;
        verifies: string;
    }[];
    diagrams: {
        id: string;
        title: string;
        nodes: { id: string; label: string; evidence: string[] }[];
        edges: { source: string; target: string; label: string }[];
        findings: { title: string; detail: string; evidence: string[] }[];
    }[];
    stats: {
        diagramCount: number;
        actionCount: number;
        importGraph: { fileCount: number; edgeCount: number };
    };
};

const scriptPath = path.join(process.cwd(), 'scripts', 'system-diagrams.mjs');

const runJson = (): SystemDiagramPayload =>
    JSON.parse(
        execFileSync(process.execPath, [scriptPath], {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: { ...process.env, SYSTEM_DIAGRAMS_SKIP_IMPORT_GRAPH: '1' }
        })
    ) as SystemDiagramPayload;

const runMarkdown = (): string =>
    execFileSync(process.execPath, [scriptPath, '--markdown'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, SYSTEM_DIAGRAMS_SKIP_IMPORT_GRAPH: '1' }
    });

describe('system diagram generator', () => {
    let payload: SystemDiagramPayload;
    let markdown: string;

    beforeAll(() => {
        payload = runJson();
        markdown = runMarkdown();
    }, 30_000);

    it('builds the expected high-level diagram set over the project graph', () => {
        expect(payload.diagrams.map((diagram) => diagram.id)).toEqual([
            'navigation-flow',
            'gameplay-resolution',
            'board-generation',
            'rewards-economy',
            'trait-systems'
        ]);
        expect(payload.stats.diagramCount).toBe(5);
        expect(payload.stats.actionCount).toBe(5);
        expect(payload.actions.map((item) => item.id)).toContain('softlock-generation-matrix');
        expect(payload.actions.find((item) => item.id === 'resolution-slice-gate')?.detail).toContain('yarn gate:action-loop');
        expect(payload.actions.find((item) => item.id === 'softlock-generation-matrix')?.verifies).toContain('Generated boards');
        expect(payload.stats.importGraph.fileCount).toBe(0);
        expect(payload.stats.importGraph.edgeCount).toBe(0);
    });

    it('links navigation and trait diagrams to concrete implementation evidence', () => {
        const navigation = payload.diagrams.find((diagram) => diagram.id === 'navigation-flow');
        const traits = payload.diagrams.find((diagram) => diagram.id === 'trait-systems');

        expect(navigation?.nodes.some((node) => node.id === 'route_contracts')).toBe(true);
        expect(navigation?.edges).toContainEqual(expect.objectContaining({
            source: 'route_contracts',
            target: 'app_store',
            label: 'validated by'
        }));
        expect(navigation?.findings[0]?.evidence).toContain('src/renderer/store/navigationModel.ts');
        expect(payload.actions.find((item) => item.id === 'softlock-generation-matrix')?.system).toBe('Board Generation');
        expect(traits?.findings[0]?.detail).toContain('trait-match-route floor share');
        expect(traits?.nodes.flatMap((node) => node.evidence)).toContain('src/shared/tile-trait-rules.ts');
    });

    it('renders Mermaid markdown for docs and reviews', () => {
        expect(markdown).toContain('# System Diagrams');
        expect(markdown).toContain('## Audit Actions');
        expect(markdown).toContain('P0 Extend the softlock matrix for every new blocker');
        expect(markdown).toContain('yarn gate:action-loop');
        expect(markdown).toContain('```mermaid');
        expect(markdown).toContain('flowchart LR');
        expect(markdown).toContain('## Trait Systems');
        expect(markdown).toContain('Softlock repair is part of the generation contract');
    });
});
