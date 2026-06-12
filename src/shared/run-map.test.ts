import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    createDungeonRunMapState,
    createRunMapState,
    chooseRunMapNode,
    clearCurrentDungeonNode,
    enterSelectedDungeonNode,
    generateRunMapChoices,
    getDungeonMapPresentation,
    getDungeonNodeTypeContract,
    getDungeonNodeTypeContracts,
    getDungeonRouteDecisionPresentation,
    inspectDungeonRunMapProgression,
    repairDungeonRunMapProgression,
    revealDungeonChoices,
    routeChoiceToMapNode,
    selectDungeonNode
} from './run-map';

describe('REG-069 run map route nodes', () => {
    it('generates deterministic local route choices with shop hooks', () => {
        const a = generateRunMapChoices({ runSeed: 69_001, rulesVersion: GAME_RULES_VERSION, currentFloor: 2 });
        const b = generateRunMapChoices({ runSeed: 69_001, rulesVersion: GAME_RULES_VERSION, currentFloor: 2 });

        expect(a).toEqual(b);
        expect(a.map((node) => node.kind).sort()).toEqual(['combat', 'event', 'shop']);
        expect(a.find((node) => node.kind === 'shop')).toMatchObject({
            label: 'Candle Vendor',
            offlineOnly: true,
            unlocksSystems: ['REG-015', 'REG-070', 'REG-071']
        });
    });

    it('tracks selected node without mutating generated options', () => {
        const state = createRunMapState(42, GAME_RULES_VERSION, 3);
        const selected = chooseRunMapNode(state, state.nextNodes[1]!.id);

        expect(state.selectedNodeId).toBeNull();
        expect(selected.selectedNodeId).toBe(state.nextNodes[1]!.id);
        expect(chooseRunMapNode(state, 'missing')).toBe(state);
    });

    it('surfaces deterministic treasure and secret hooks on the route map', () => {
        const treasure = generateRunMapChoices({ runSeed: 75_001, rulesVersion: GAME_RULES_VERSION, currentFloor: 3 });
        const secret = generateRunMapChoices({ runSeed: 75_001, rulesVersion: GAME_RULES_VERSION, currentFloor: 6 });

        expect(treasure.map((node) => node.kind)).toContain('treasure');
        expect(treasure.find((node) => node.kind === 'treasure')).toMatchObject({
            label: 'Sealed Gallery',
            unlocksSystems: ['REG-017', 'REG-069', 'REG-075']
        });
        expect(secret.find((node) => node.kind === 'event')?.detail).toContain('archive oddity');
    });

    it('promotes route choices into a persistent dungeon graph', () => {
        const routeChoices = [
            {
                id: 'choice:safe',
                routeType: 'safe' as const,
                label: 'Safe passage',
                detail: 'Standard next floor.'
            },
            {
                id: 'choice:greed',
                routeType: 'greed' as const,
                label: 'Greedy route',
                detail: 'Higher pressure route hook.'
            },
            {
                id: 'choice:mystery',
                routeType: 'mystery' as const,
                label: 'Mystery route',
                detail: 'Hidden treasure or secret-room hook.'
            }
        ];
        const initial = createDungeonRunMapState(99, GAME_RULES_VERSION, 1);
        const revealed = revealDungeonChoices(initial, 1, routeChoices);
        const selected = selectDungeonNode(revealed, 'choice:greed');
        const entered = enterSelectedDungeonNode(selected);

        expect(revealed.nodes.find((node) => node.id === initial.currentNodeId)?.status).toBe('cleared');
        expect(revealed.nodes.filter((node) => node.status === 'revealed')).toHaveLength(3);
        expect(entered.currentNodeId).toBe('choice:greed');
        expect(entered.nodes.find((node) => node.id === 'choice:greed')).toMatchObject({
            kind: 'elite',
            status: 'current'
        });
        expect(entered.nodes.find((node) => node.id === 'choice:safe')?.status).toBe('skipped');
    });

    it('clears the current dungeon node without revealing a branch', () => {
        const state = createDungeonRunMapState(99, GAME_RULES_VERSION, 1);

        const cleared = clearCurrentDungeonNode(state, 1);

        expect(cleared.currentFloor).toBe(1);
        expect(cleared.currentNodeId).toBe(state.currentNodeId);
        expect(cleared.nodes.find((node) => node.id === state.currentNodeId)).toMatchObject({
            status: 'cleared'
        });
    });

    it('keeps skipped route siblings from reopening after a branch is selected', () => {
        const routeChoices = [
            { id: 'choice:safe', routeType: 'safe' as const, label: 'Safe passage', detail: 'Standard next floor.' },
            { id: 'choice:greed', routeType: 'greed' as const, label: 'Greedy route', detail: 'Elite route.' },
            { id: 'choice:mystery', routeType: 'mystery' as const, label: 'Mystery route', detail: 'Event route.' }
        ];
        const revealed = revealDungeonChoices(createDungeonRunMapState(102, GAME_RULES_VERSION, 1), 1, routeChoices);
        const selected = selectDungeonNode(revealed, 'choice:mystery');

        expect(inspectDungeonRunMapProgression(selected).issues).toEqual([]);

        const entered = enterSelectedDungeonNode(selected);
        expect(entered.nodes.find((node) => node.id === 'choice:safe')?.status).toBe('skipped');
        expect(entered.nodes.find((node) => node.id === 'choice:greed')?.status).toBe('skipped');
        expect(entered.nodes.find((node) => node.id === 'choice:mystery')?.status).toBe('current');
    });

    it('repairs missing route exits into deterministic fallback choices', () => {
        const state = createDungeonRunMapState(103, GAME_RULES_VERSION, 2);
        const damaged = {
            ...state,
            nodes: state.nodes.map((node) =>
                node.id === state.currentNodeId ? { ...node, edgeIds: ['missing-route-node'] } : node
            )
        };

        expect(inspectDungeonRunMapProgression(damaged).hasLegalProgressionPath).toBe(false);

        const repaired = repairDungeonRunMapProgression(damaged);
        const report = inspectDungeonRunMapProgression(repaired);

        expect(report.issues).toEqual([]);
        expect(report.legalTargetIds).toHaveLength(3);
        expect(repaired.nodes.filter((node) => node.floor === 3 && node.status === 'revealed')).toHaveLength(3);
    });

    it('dedupes repeated node ids while preserving the playable current room', () => {
        const state = createDungeonRunMapState(104, GAME_RULES_VERSION, 2);
        const staleDuplicate = { ...state.nodes[0]!, status: 'hidden' as const, edgeIds: [] };
        const currentWithExit = { ...state.nodes[0]!, edgeIds: ['fallback-missing'] };
        const damaged = {
            ...state,
            nodes: [staleDuplicate, currentWithExit]
        };

        expect(inspectDungeonRunMapProgression(damaged).issues.map((issue) => issue.code)).toContain(
            'route_duplicate_node_id'
        );

        const repaired = repairDungeonRunMapProgression(damaged);
        const report = inspectDungeonRunMapProgression(repaired);

        expect(report.issues).toEqual([]);
        expect(repaired.nodes.filter((node) => node.id === state.currentNodeId)).toHaveLength(1);
        expect(repaired.nodes.find((node) => node.id === state.currentNodeId)).toMatchObject({
            status: 'current'
        });
    });

    it('clears stale revealed backtracks and orphan future branches during repair', () => {
        const routeChoices = [
            { id: 'choice:safe', routeType: 'safe' as const, label: 'Safe passage', detail: 'Standard next floor.' },
            { id: 'choice:greed', routeType: 'greed' as const, label: 'Greedy route', detail: 'Elite route.' }
        ];
        const revealed = revealDungeonChoices(createDungeonRunMapState(105, GAME_RULES_VERSION, 1), 1, routeChoices);
        const entered = enterSelectedDungeonNode(selectDungeonNode(revealed, 'choice:safe'));
        const staleBacktrack = {
            ...routeChoiceToMapNode(
                { id: 'stale:backtrack', routeType: 'mystery', label: 'Stale backtrack', detail: 'Old branch.' },
                1,
                1
            ),
            status: 'revealed' as const
        };
        const orphanFuture = {
            ...routeChoiceToMapNode(
                { id: 'stale:future', routeType: 'greed', label: 'Stale future', detail: 'Unlinked branch.' },
                4,
                1
            ),
            status: 'revealed' as const
        };
        const damaged = {
            ...entered,
            nodes: [...entered.nodes, staleBacktrack, orphanFuture]
        };

        expect(inspectDungeonRunMapProgression(damaged).issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['route_stale_revealed_backtrack', 'route_orphan_revealed_future'])
        );

        const repaired = repairDungeonRunMapProgression(damaged);
        const report = inspectDungeonRunMapProgression(repaired);

        expect(report.issues).toEqual([]);
        expect(repaired.nodes.find((node) => node.id === 'stale:backtrack')?.status).toBe('skipped');
        expect(repaired.nodes.find((node) => node.id === 'stale:future')?.status).toBe('hidden');
    });

    it('demotes stale current siblings without reopening illegal backtracks', () => {
        const state = createDungeonRunMapState(108, GAME_RULES_VERSION, 3);
        const staleCurrentSibling = {
            ...routeChoiceToMapNode(
                { id: 'stale:sibling-current', routeType: 'mystery', label: 'Stale sibling', detail: 'Old branch.' },
                state.currentFloor,
                1
            ),
            status: 'current' as const
        };
        const staleFutureCurrent = {
            ...routeChoiceToMapNode(
                { id: 'stale:future-current', routeType: 'greed', label: 'Stale future', detail: 'Future branch.' },
                state.currentFloor + 2,
                1
            ),
            status: 'current' as const
        };
        const damaged = {
            ...state,
            nodes: [...state.nodes, staleCurrentSibling, staleFutureCurrent]
        };

        expect(inspectDungeonRunMapProgression(damaged).issues.map((issue) => issue.code)).toContain(
            'route_multiple_current_nodes'
        );

        const repaired = repairDungeonRunMapProgression(damaged);
        const report = inspectDungeonRunMapProgression(repaired);

        expect(report.issues).toEqual([]);
        expect(repaired.nodes.find((node) => node.id === 'stale:sibling-current')?.status).toBe('skipped');
        expect(repaired.nodes.find((node) => node.id === 'stale:future-current')?.status).toBe('hidden');
        expect(repaired.nodes.filter((node) => node.status === 'current')).toHaveLength(1);
    });

    it('builds UI-ready room and map presentation for the dungeon shell', () => {
        const routeChoices = [
            {
                id: 'choice:safe',
                routeType: 'safe' as const,
                label: 'Safe passage',
                detail: 'Standard next floor.'
            },
            {
                id: 'choice:greed',
                routeType: 'greed' as const,
                label: 'Greedy route',
                detail: 'Higher pressure route hook.'
            }
        ];
        const map = revealDungeonChoices(createDungeonRunMapState(101, GAME_RULES_VERSION, 1), 1, routeChoices);
        const presentation = getDungeonMapPresentation(map);

        expect(presentation.current).toMatchObject({
            label: 'Threshold Archive',
            glyph: 'G',
            tone: 'safe'
        });
        expect(presentation.revealed.map((node) => node.label)).toEqual(['Safe passage', 'Greedy route']);
        expect(presentation.revealed.find((node) => node.id === 'choice:greed')).toMatchObject({
            mechanic: 'Sentinel pressure and greed anchors.',
            tone: 'danger'
        });
        expect(presentation.bossDistance).toBe(5);
    });

    it('DNG-010 builds route decision rows with consistent risk and reward columns', () => {
        const routeChoices = [
            {
                id: 'choice:safe',
                routeType: 'safe' as const,
                label: 'Safe passage',
                detail: 'Standard next floor.',
                rewardPreview: 'Steady clear route.',
                riskPreview: 'Low threat.'
            },
            {
                id: 'choice:greed',
                routeType: 'greed' as const,
                label: 'Greedy route',
                detail: 'Higher pressure route hook.',
                rewardPreview: 'Better cache odds.',
                riskPreview: 'High pressure.'
            },
            {
                id: 'choice:mystery',
                routeType: 'mystery' as const,
                label: 'Mystery route',
                detail: 'Hidden treasure or secret-room hook.',
                rewardPreview: 'Unknown room reward.',
                riskPreview: 'Unusual rules.'
            }
        ];
        const decision = getDungeonRouteDecisionPresentation(
            createDungeonRunMapState(101, GAME_RULES_VERSION, 1),
            routeChoices
        );

        expect(decision.current?.label).toBe('Threshold Archive');
        expect(decision.rows.map((row) => row.choiceLabel)).toEqual(['Safe passage', 'Greedy route', 'Mystery route']);
        expect(decision.rows.every((row) => row.sourceNodeId === decision.current?.id)).toBe(true);
        expect(decision.rows.every((row) => row.targetFloor === 2)).toBe(true);
        expect(decision.rows.map((row) => row.reward)).toEqual(['Steady clear route.', 'Better cache odds.', 'Unknown room reward.']);
        expect(decision.rows.map((row) => row.risk)).toEqual(['Low threat.', 'High pressure.', 'Unusual rules.']);
        expect(decision.rows.find((row) => row.id === 'choice:greed')).toMatchObject({
            nodeKind: 'elite',
            tone: 'danger',
            mechanic: 'Sentinel pressure and greed anchors.'
        });
        expect(decision.summary).toContain('Safe passage -> Recall Hall depth 2: Standard next floor.');
        expect(decision.summary).toContain('Greedy route -> Mnemonic Sentinel depth 2: Higher pressure route hook.');
    });

    it('keeps converged boss-gate choices readable by preserving route approach labels', () => {
        const routeChoices = [
            {
                id: 'choice:safe-boss',
                routeType: 'safe' as const,
                label: 'Safe passage',
                detail: 'Boss gate through a controlled route.'
            },
            {
                id: 'choice:greed-boss',
                routeType: 'greed' as const,
                label: 'Greedy route',
                detail: 'Boss gate through an elite route.'
            },
            {
                id: 'choice:mystery-boss',
                routeType: 'mystery' as const,
                label: 'Mystery route',
                detail: 'Boss gate through an omen route.'
            }
        ];
        const state = createDungeonRunMapState(106, GAME_RULES_VERSION, 5);
        const map = revealDungeonChoices(state, 5, routeChoices);
        const presentation = getDungeonMapPresentation(map);
        const decision = getDungeonRouteDecisionPresentation(state, routeChoices);

        expect(presentation.revealed.map((node) => node.label)).toEqual([
            'Keeper Chamber',
            'Keeper Chamber',
            'Keeper Chamber'
        ]);
        expect(presentation.revealed.map((node) => node.eyebrow)).toEqual([
            'Act 1 boss / Safe passage',
            'Act 1 boss / Greedy route',
            'Act 1 boss / Mystery route'
        ]);
        expect(decision.rows.map((row) => row.nodeLabel)).toEqual([
            'Keeper Chamber via Safe passage',
            'Keeper Chamber via Greedy route',
            'Keeper Chamber via Mystery route'
        ]);
        expect(decision.summary).toContain('Mystery route -> Keeper Chamber via Mystery route depth 6');
    });

    it('keeps generated boss floor previews readable after route shuffle', () => {
        const state = createDungeonRunMapState(107, GAME_RULES_VERSION, 5);
        const choices = generateRunMapChoices({
            runSeed: state.seed,
            rulesVersion: state.rulesVersion,
            currentFloor: state.currentFloor
        });
        const map = revealDungeonChoices(state, state.currentFloor, choices);
        const presentation = getDungeonMapPresentation(map);

        expect(choices.every((node) => node.kind === 'boss')).toBe(true);
        expect(choices.map((node) => node.routeType)).toEqual(['greed', 'greed', 'greed']);
        expect(choices.map((node) => node.routeApproachType).sort()).toEqual(['greed', 'mystery', 'safe']);
        expect(presentation.revealed.map((node) => node.label)).toEqual([
            'Keeper Chamber',
            'Keeper Chamber',
            'Keeper Chamber'
        ]);
        expect(presentation.revealed.map((node) => node.eyebrow).sort()).toEqual([
            'Act 1 boss / Greedy route',
            'Act 1 boss / Mystery route',
            'Act 1 boss / Safe passage'
        ]);
    });

    it('DNG-011 covers every dungeon node kind with a renderable contract', () => {
        const contracts = getDungeonNodeTypeContracts();

        expect(contracts.map((contract) => contract.kind)).toEqual([
            'entrance',
            'combat',
            'elite',
            'trap',
            'treasure',
            'shop',
            'rest',
            'event',
            'boss',
            'exit'
        ]);
        expect(contracts.every((contract) => contract.label.length > 0)).toBe(true);
        expect(contracts.every((contract) => contract.rewardPolicy.length > 0)).toBe(true);
        expect(contracts.every((contract) => Object.keys(contract.cardFamilyBounds).length > 0)).toBe(true);
        expect(getDungeonNodeTypeContract('boss')).toMatchObject({
            floorTag: 'boss',
            defaultObjectiveId: 'defeat_boss',
            routeType: 'greed',
            uiTone: 'boss'
        });
        expect(getDungeonNodeTypeContract('shop')).toMatchObject({
            floorTag: 'breather',
            floorArchetypeId: 'breather',
            defaultObjectiveId: 'find_exit'
        });
        expect(getDungeonNodeTypeContract('trap').cardFamilyBounds.trap).toEqual({ min: 1, max: 4 });
        expect(getDungeonNodeTypeContract('treasure').cardFamilyBounds.treasure).toEqual({ min: 1, max: 4 });
    });

    it('keeps node presentation anchored to archive-memory dungeon tone', () => {
        const byKind = Object.fromEntries(getDungeonNodeTypeContracts().map((contract) => [contract.kind, contract]));

        expect(byKind.combat?.label).toBe('Recall Hall');
        expect(byKind.event?.label).toBe('Omen Archive');
        expect(byKind.exit?.label).toBe('Palimpsest Stair');
        expect(byKind.trap?.rewardPolicy).toContain('latchwork');
        expect(byKind.boss?.rewardPolicy).toContain('Keeper');
    });
});
