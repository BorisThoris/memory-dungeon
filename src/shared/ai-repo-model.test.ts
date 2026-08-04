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
        runStateFieldCount: number;
        dormantRunStateFieldCount: number;
        rendererRunStateWriteCount: number;
        orchestrationBudgetViolationCount: number;
        gameplayCommandTypeCount: number;
        gameplayEventTypeCount: number;
        unhandledGameplayCommandTypeCount: number;
        unemittedGameplayEventTypeCount: number;
        untestedGameplayProtocolTypeCount: number;
        playerVisibleStateCount: number;
        relationshipCount: number;
    };
    files: { id: string; path: string; lineCount: number; imports: string[]; testedBy: string[] }[];
    symbols: { id: string; file: string; line: number; endLine: number }[];
    content: { id: string; kind: string; expectedMechanicId: string; source: { path: string; line: number | null } }[];
    mechanics: { id: string; evidence: { path: string; line: number | null }[]; tests: { path: string; line: number | null }[] }[];
    states: { id: string; name: string; playerVisible: boolean }[];
    runStateFields: {
        id: string;
        name: string;
        source: { path: string; line: number };
        readReferences: { path: string; line: number }[];
        writeReferences: {
            path: string;
            line: number;
            accessKind: 'direct_assignment' | 'state_construction';
        }[];
    }[];
    orchestrationBudgets: {
        id: string;
        path: string;
        lineCount: number | null;
        importCount: number | null;
        maxLines: number;
        maxImports: number;
        withinBudget: boolean;
    }[];
    gameplayCommands: {
        id: string;
        name: string;
        source: { path: string; line: number };
        payloadFields: string[];
        handlerReferences: { path: string; line: number }[];
        creatorReferences: { path: string; line: number }[];
        testReferences: { path: string; line: number }[];
    }[];
    gameplayEvents: {
        id: string;
        name: string;
        source: { path: string; line: number };
        payloadFields: string[];
        emitterReferences: { path: string; line: number }[];
        consumerReferences: { path: string; line: number }[];
        testReferences: { path: string; line: number }[];
    }[];
    playerVisibleStates: string[];
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
        expect(model.schemaVersion).toBe(6);
        expect(model.repository.trackedFileCount).toBeGreaterThan(2_000);
        expect(model.repository.codeFileCount).toBeGreaterThan(800);
        expect(model.repository.exportedSymbolCount).toBeGreaterThan(1_000);
        expect(model.repository.contentItemCount).toBeGreaterThan(50);
        expect(model.repository.mechanicCount).toBeGreaterThan(20);
        expect(model.repository.stateFieldCount).toBeGreaterThan(20);
        expect(model.repository.runStateFieldCount).toBeGreaterThan(120);
        expect(model.repository.runStateFieldCount).toBe(model.runStateFields.length);
        expect(model.repository.dormantRunStateFieldCount).toBe(0);
        expect(model.repository.rendererRunStateWriteCount).toBe(0);
        expect(model.repository.orchestrationBudgetViolationCount).toBe(0);
        expect(model.repository.gameplayCommandTypeCount).toBe(37);
        expect(model.repository.gameplayEventTypeCount).toBe(57);
        expect(model.repository.unhandledGameplayCommandTypeCount).toBe(0);
        expect(model.repository.unemittedGameplayEventTypeCount).toBe(0);
        expect(model.repository.untestedGameplayProtocolTypeCount).toBe(0);
        expect(model.repository.playerVisibleStateCount).toBeGreaterThanOrEqual(27);
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
        expect(model.playerVisibleStates).toEqual(expect.arrayContaining([
            'currentLevelScore',
            'destroyPairCharges',
            'dungeonKeys',
            'peekCharges',
            'pinnedTileIds',
            'relicFavorProgress',
            'totalScore'
        ]));
        expect(model.states.filter((state) => state.playerVisible).map((state) => state.name).sort()).toEqual(
            [...model.playerVisibleStates].sort()
        );
        expect(model.runStateFields.every((field) => field.source.line > 0 && field.readReferences.length > 0)).toBe(true);
        expect(model.runStateFields.flatMap((field) => field.writeReferences).every(
            (reference) => reference.accessKind === 'direct_assignment' || reference.accessKind === 'state_construction'
        )).toBe(true);
        expect(model.runStateFields.flatMap((field) => field.writeReferences).filter(
            (reference) => reference.path.startsWith('src/renderer/') && !reference.path.startsWith('src/renderer/dev/')
        )).toEqual([]);
        expect(model.runStateFields.flatMap((field) => field.writeReferences)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: 'src/renderer/dev/hudFixtures.ts',
                    accessKind: 'state_construction'
                })
            ])
        );
        expect(model.runStateFields.map((field) => field.name)).not.toEqual(
            expect.arrayContaining(['dailyStreakCount', 'dungeonShopVisitedThisFloor', 'wildTileId'])
        );
        expect(model.runStateFields.find((field) => field.name === 'regionShuffleCharges')).toMatchObject({
            id: 'run_state_field:regionShuffleCharges',
            source: { path: 'src/shared/contracts.ts', line: expect.any(Number) },
            readReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/board-power-actions.ts', line: expect.any(Number) })
            ]),
            writeReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-creation-rules.ts', line: expect.any(Number) })
            ])
        });
        expect(model.runStateFields.find((field) => field.name === 'weakerShuffleMode')).toMatchObject({
            writeReferences: expect.arrayContaining([
                expect.objectContaining({
                    path: 'src/shared/run-settings-rules.ts',
                    line: expect.any(Number),
                    accessKind: 'state_construction'
                })
            ])
        });
        expect(model.orchestrationBudgets).toEqual([
            {
                id: 'orchestration_budget:src/renderer/components/GameScreen.tsx',
                path: 'src/renderer/components/GameScreen.tsx',
                lineCount: expect.any(Number),
                importCount: expect.any(Number),
                maxLines: 1_950,
                maxImports: 55,
                withinBudget: true
            },
            {
                id: 'orchestration_budget:src/renderer/components/GameScreenBoardFloater.tsx',
                path: 'src/renderer/components/GameScreenBoardFloater.tsx',
                lineCount: expect.any(Number),
                importCount: expect.any(Number),
                maxLines: 225,
                maxImports: 4,
                withinBudget: true
            },
            {
                id: 'orchestration_budget:src/renderer/components/GameScreenMatchFloaterContent.tsx',
                path: 'src/renderer/components/GameScreenMatchFloaterContent.tsx',
                lineCount: expect.any(Number),
                importCount: expect.any(Number),
                maxLines: 875,
                maxImports: 5,
                withinBudget: true
            },
            {
                id: 'orchestration_budget:src/renderer/components/GameScreenMismatchFloaterContent.tsx',
                path: 'src/renderer/components/GameScreenMismatchFloaterContent.tsx',
                lineCount: expect.any(Number),
                importCount: expect.any(Number),
                maxLines: 350,
                maxImports: 3,
                withinBudget: true
            }
        ]);
        expect(model.orchestrationBudgets[0]?.lineCount).toBeLessThanOrEqual(1_950);
        expect(model.orchestrationBudgets[0]?.importCount).toBeLessThanOrEqual(55);
        expect(model.orchestrationBudgets[1]?.lineCount).toBeLessThanOrEqual(225);
        expect(model.orchestrationBudgets[1]?.importCount).toBeLessThanOrEqual(4);
        expect(model.orchestrationBudgets[2]?.lineCount).toBeLessThanOrEqual(875);
        expect(model.orchestrationBudgets[2]?.importCount).toBeLessThanOrEqual(5);
        expect(model.orchestrationBudgets[3]?.lineCount).toBeLessThanOrEqual(350);
        expect(model.orchestrationBudgets[3]?.importCount).toBeLessThanOrEqual(3);
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenBoardFeedbackModel.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenBoardFeedbackModel.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenDecisionSignals.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenDecisionSignals.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenFloorClearFeedbackModel.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenFloorClearFeedbackModel.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenRouteChoiceModel.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenRouteChoiceModel.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/useGameScreenRouteChoiceProjection.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/useGameScreenRouteChoiceProjection.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenRouteChoicePanel.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenRouteChoicePanel.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenRouteConsequenceProjection.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenRouteConsequenceProjection.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenRouteConsequenceFeedback.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenRouteConsequenceFeedback.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenNextFloorProjection.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenNextFloorProjection.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenNextFloorPreview.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenNextFloorPreview.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenFloorClearResult.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenFloorClearResult.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/gameScreenBoardFloaterModel.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/gameScreenBoardFloaterModel.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/useGameScreenBoardFloaterProjection.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/useGameScreenBoardFloaterProjection.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenBoardFloater.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenBoardFloater.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenMatchFloaterContent.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenBoardFloater.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/GameScreenMismatchFloaterContent.tsx')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/GameScreenBoardFloater.test.tsx'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/renderer/components/useGameScreenFloorClearProjection.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/renderer/components/useGameScreenFloorClearProjection.test.ts'
            ])
        });
        expect(model.files.find((file) => file.path === 'src/shared/run-start-core.ts')).toMatchObject({
            testedBy: expect.arrayContaining([
                'file:src/shared/run-start-core.test.ts'
            ])
        });
        expect(model.gameplayCommands.every(
            (command) => command.source.line > 0 && command.handlerReferences.length > 0 && command.testReferences.length > 0
        )).toBe(true);
        expect(model.gameplayEvents.every(
            (event) => event.source.line > 0 && event.emitterReferences.length > 0 && event.testReferences.length > 0
        )).toBe(true);
        expect(
            [...model.gameplayCommands, ...model.gameplayEvents].flatMap((variant) =>
                variant.testReferences.map((reference) => reference.path)
            )
        ).not.toEqual(expect.arrayContaining([
            'src/shared/ai-repo-model.test.ts',
            'src/shared/gameplay-interaction-graph.test.ts'
        ]));
        expect(model.gameplayCommands.find((command) => command.name === 'effects.apply')).toMatchObject({
            id: 'gameplay_command:effects.apply',
            source: { path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) },
            handlerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.ts', line: expect.any(Number) })
            ]),
            creatorReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayCommands.find((command) => command.name === 'run.start')).toMatchObject({
            id: 'gameplay_command:run.start',
            schema: 'runStartCommandSchema',
            source: { path: 'src/shared/run-start-core-contracts.ts', line: expect.any(Number) },
            handlerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-start-core.ts', line: expect.any(Number) })
            ]),
            creatorReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-start-core-contracts.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-start-core.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayEvents.find((event) => event.name === 'run.started')).toMatchObject({
            id: 'gameplay_event:run.started',
            emitterReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-start-core.ts', line: expect.any(Number) })
            ]),
            consumerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/renderer/store/runStartState.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/run-start-core.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayCommands.find((command) => command.name === 'run.interlude_terminal_resolve')).toMatchObject({
            id: 'gameplay_command:run.interlude_terminal_resolve',
            source: { path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) },
            handlerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.ts', line: expect.any(Number) })
            ]),
            creatorReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/shared/gameplay-core-simulation.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayEvents.find((event) => event.name === 'run.interlude_terminal_resolved')).toMatchObject({
            id: 'gameplay_event:run.interlude_terminal_resolved',
            source: { path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) },
            emitterReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/shared/gameplay-core-simulation.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayCommands.find((command) => command.name === 'run.finalize')).toMatchObject({
            id: 'gameplay_command:run.finalize',
            source: { path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) },
            handlerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.ts', line: expect.any(Number) })
            ]),
            creatorReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/shared/gameplay-core-simulation.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/renderer/store/runResolutionController.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/renderer/store/useAppStore.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayEvents.find((event) => event.name === 'run.finalized')).toMatchObject({
            id: 'gameplay_event:run.finalized',
            source: { path: 'src/shared/gameplay-core-contracts.ts', line: expect.any(Number) },
            emitterReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-core.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/shared/gameplay-core-simulation.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/renderer/store/runResolutionController.test.ts', line: expect.any(Number) }),
                expect.objectContaining({ path: 'src/renderer/store/useAppStore.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayEvents.find((event) => event.name === 'effect.skipped')).toMatchObject({
            id: 'gameplay_event:effect.skipped',
            emitterReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-effect-transition.ts', line: expect.any(Number) })
            ]),
            testReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/shared/gameplay-effect-transition.test.ts', line: expect.any(Number) })
            ])
        });
        expect(model.gameplayEvents.find((event) => event.name === 'feedback.requested')).toMatchObject({
            consumerReferences: expect.arrayContaining([
                expect.objectContaining({ path: 'src/renderer/store/gameplayFeedbackAdapter.ts', line: expect.any(Number) })
            ])
        });
        expect(model.relationships.map((edge) => edge.kind)).toEqual(
            expect.arrayContaining([
                'imports',
                'exports',
                'declares',
                'declared_by',
                'implemented_by',
                'tested_by',
                'reads',
                'writes',
                'handles',
                'creates',
                'emits',
                'consumes',
                'persists',
                'displays'
            ])
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

        const runStateQueryOutput = execFileSync(process.execPath, [scriptPath, '--query', 'run_state_field:recallFocus'], {
            cwd: repoRoot,
            encoding: 'utf8'
        });
        const runStateQuery = JSON.parse(runStateQueryOutput) as { nodes: { id: string }[]; relationships: unknown[] };
        expect(runStateQuery.nodes.map((node) => node.id)).toContain('run_state_field:recallFocus');
        expect(runStateQuery.relationships.length).toBeGreaterThan(0);

        const protocolQueryOutput = execFileSync(
            process.execPath,
            [scriptPath, '--query', 'gameplay_command:board.region_shuffle'],
            { cwd: repoRoot, encoding: 'utf8' }
        );
        const protocolQuery = JSON.parse(protocolQueryOutput) as { nodes: { id: string }[]; relationships: unknown[] };
        expect(protocolQuery.nodes.map((node) => node.id)).toContain('gameplay_command:board.region_shuffle');
        expect(protocolQuery.relationships.length).toBeGreaterThan(0);

        const orchestrationQueryOutput = execFileSync(
            process.execPath,
            [scriptPath, '--query', 'orchestration_budget:src/renderer/components/GameScreen.tsx'],
            { cwd: repoRoot, encoding: 'utf8' }
        );
        const orchestrationQuery = JSON.parse(orchestrationQueryOutput) as {
            nodes: { id: string }[];
            relationships: unknown[];
        };
        expect(orchestrationQuery.nodes.map((node) => node.id)).toContain(
            'orchestration_budget:src/renderer/components/GameScreen.tsx'
        );
        expect(orchestrationQuery.relationships.length).toBeGreaterThan(0);
    }, 180_000);

    it('registers model generation and drift checks in the project gates', () => {
        expect(packageJson.scripts['ai:model']).toBe('node scripts/ai-repo-model.mjs --write');
        expect(packageJson.scripts['ai:model:check']).toBe('node scripts/ai-repo-model.mjs --check');
        expect(packageJson.scripts['ai:model:query']).toBe('node scripts/ai-repo-model.mjs --query');
        expect(packageJson.scripts['gate:systems']).toContain('yarn ai:model:check');
    });
});
