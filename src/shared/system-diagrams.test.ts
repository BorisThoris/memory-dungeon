import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

type SystemDiagramPayload = {
    actions: {
        id: string;
        priority: string;
        status: string;
        command: string | null;
        system: string;
        title: string;
        detail: string;
        verifies: string;
        evidence: string[];
        minimumEvidence?: number;
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
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
};

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

const referencedYarnScripts = (commands: readonly (string | null)[]): string[] =>
    [
        ...new Set(
            commands.flatMap((command) =>
                [...(command ?? '').matchAll(/\byarn\s+([A-Za-z0-9:_-]+)/g)]
                    .map((match) => match[1]!)
                    .filter((script) => script !== 'vitest')
            )
        )
    ];

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
            'gameplay-interaction-graph',
            'board-generation',
            'rewards-economy',
            'trait-systems',
            'persistence-save-flow',
            'renderer-input-flow',
            'audio-feedback-pipeline',
            'asset-card-rendering',
            'test-gate-architecture'
        ]);
        expect(payload.stats.diagramCount).toBe(11);
        expect(payload.stats.actionCount).toBe(18);
        expect(payload.actions.map((item) => item.id)).toContain('softlock-generation-matrix');
        expect(payload.actions.every((item) => item.status === 'done')).toBe(true);
        expect(payload.actions.map((item) => item.command)).toEqual(
            expect.arrayContaining(['yarn gate:action-loop', 'yarn gate:rewards-economy', 'yarn gate:navigation', 'yarn gate:systems'])
        );
        expect(payload.actions.map((item) => item.command)).toEqual(
            expect.arrayContaining([
                'yarn gate:persistence',
                'yarn gate:renderer-input',
                'yarn gate:audio-feedback',
                'yarn gate:asset-rendering',
                'yarn gate:security',
                'yarn gate:package-hygiene',
                'yarn gate:build-output',
                'yarn gate:desktop-build',
                'yarn gate:softlock-full',
                'yarn test:e2e:browser-smoke',
                'yarn test:e2e:renderer-qa:3d'
            ])
        );
        expect(payload.actions.every((item) => item.command != null && item.command.length > 0)).toBe(true);
        expect(payload.actions.every((item) => item.evidence.length >= (item.minimumEvidence ?? 1))).toBe(true);
        expect(payload.actions.find((item) => item.id === 'resolution-slice-gate')?.detail).toContain('yarn gate:action-loop');
        expect(payload.actions.find((item) => item.id === 'softlock-generation-matrix')).toMatchObject({
            command: 'yarn audit:dungeon-topology:json && yarn gate:sim-softlock-seeds',
            verifies: expect.stringContaining('Generated boards')
        });
        expect(payload.stats.importGraph.fileCount).toBe(0);
        expect(payload.stats.importGraph.edgeCount).toBe(0);
    });

    it('links navigation and trait diagrams to concrete implementation evidence', () => {
        const navigation = payload.diagrams.find((diagram) => diagram.id === 'navigation-flow');
        const traits = payload.diagrams.find((diagram) => diagram.id === 'trait-systems');
        const boardGeneration = payload.diagrams.find((diagram) => diagram.id === 'board-generation');

        expect(navigation?.nodes.some((node) => node.id === 'route_contracts')).toBe(true);
        expect(navigation?.edges).toContainEqual(expect.objectContaining({
            source: 'route_contracts',
            target: 'app_store',
            label: 'validated by'
        }));
        expect(navigation?.findings[0]?.evidence).toContain('src/renderer/store/navigationModel.ts');
        expect(payload.actions.find((item) => item.id === 'softlock-generation-matrix')?.system).toBe('Board Generation');
        expect(boardGeneration?.nodes.some((node) => node.id === 'topology_graph')).toBe(true);
        expect(boardGeneration?.edges).toContainEqual(expect.objectContaining({
            source: 'topology_graph',
            target: 'softlock_repair',
            label: 'validates blockers'
        }));
        expect(traits?.findings[0]?.detail).toContain('trait-match-route floor share');
        expect(traits?.nodes.flatMap((node) => node.evidence)).toContain('src/shared/tile-trait-rules.ts');
    });

    it('references package scripts that exist in audit action commands', () => {
        const missing = referencedYarnScripts(payload.actions.map((action) => action.command)).filter(
            (script) => packageJson.scripts[script] == null
        );

        expect(missing).toEqual([]);
    });

    it('renders Mermaid markdown for docs and reviews', () => {
        expect(markdown).toContain('# System Diagrams');
        expect(markdown).toContain('## Audit Actions');
        expect(markdown).toContain('P0 Extend the softlock matrix for every new blocker');
        expect(markdown).toContain('yarn gate:action-loop');
        expect(markdown).toContain('yarn audit:dungeon-topology');
        expect(markdown).toContain('yarn gate:sim-softlock-seeds');
        expect(markdown).toContain('yarn gate:softlock-full');
        expect(markdown).toContain('yarn gate:rewards-economy');
        expect(markdown).toContain('yarn gate:navigation');
        expect(markdown).toContain('yarn gate:security');
        expect(markdown).toContain('yarn gate:package-hygiene');
        expect(markdown).toContain('yarn gate:build-output');
        expect(markdown).toContain('yarn gate:desktop-build');
        expect(markdown).toContain('yarn test:e2e:browser-smoke');
        expect(markdown).toContain('yarn test:e2e:renderer-qa:3d');
        expect(markdown).toContain('## Renderer Input Flow');
        expect(markdown).toContain('## Test Gate Architecture');
        expect(markdown).toContain('## Gameplay Interaction Graph');
        expect(markdown).toContain('Cross-feature logic now has an executable graph');
        expect(markdown).toContain('```mermaid');
        expect(markdown).toContain('flowchart LR');
        expect(markdown).toContain('## Trait Systems');
        expect(markdown).toContain('Softlock repair is part of the generation contract');
        expect(markdown).toContain('Topology Graph');
    });
});
