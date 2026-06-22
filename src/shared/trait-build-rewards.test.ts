import { describe, expect, it } from 'vitest';
import type { TileTraitKind } from './contracts';
import { buildBoard } from './board-build-rules';
import {
    getTraitBuildBoardHint,
    getTraitBuildDraftHintForBoard,
    getTraitBuildDraftHintForRelic,
    getTraitBuildRewardRows,
    getTraitBuildRewardRowsForBoard,
    getTraitBuildRewardRowsForLoadout,
    getTraitBuildRewardRowsForRelic,
    getTraitBuildRewardRowsForTrait,
    TRAIT_BUILD_REWARD_ROWS
} from './trait-build-rewards';

const ALL_TRAITS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

describe('trait build reward rows', () => {
    it('keeps every current trait represented by at least one reward archetype', () => {
        const represented = new Set(getTraitBuildRewardRows().flatMap((row) => row.traitKinds));

        for (const trait of ALL_TRAITS) {
            expect(represented.has(trait)).toBe(true);
            expect(getTraitBuildRewardRowsForTrait(trait).length).toBeGreaterThan(0);
        }
    });

    it('connects every trait build archetype to relic and shop support', () => {
        const rows = getTraitBuildRewardRows();

        expect(rows).toHaveLength(TRAIT_BUILD_REWARD_ROWS.length);
        expect(rows.every((row) => row.traitKinds.length >= 2)).toBe(true);
        expect(rows.every((row) => row.relicIds.length > 0)).toBe(true);
        expect(rows.every((row) => row.shopItemIds.includes('region_shuffle_charge'))).toBe(true);
        expect(rows.every((row) => row.decision.length > 0 && row.payoff.length > 0)).toBe(true);
        expect(rows.every((row) => row.regressionHook.startsWith('trait-build:'))).toBe(true);
    });

    it('returns defensive copies for callers that build UI or reports', () => {
        const [row] = getTraitBuildRewardRows();
        row!.traitKinds.push('echo');
        row!.relicIds.length = 0;

        expect(getTraitBuildRewardRows()[0]!.relicIds.length).toBeGreaterThan(0);
        expect(getTraitBuildRewardRows()[0]!.traitKinds).toEqual(TRAIT_BUILD_REWARD_ROWS[0]!.traitKinds);
    });

    it('summarizes relic-driven trait build hints for reward drafts', () => {
        expect(getTraitBuildRewardRowsForRelic('chapter_compass').map((row) => row.id)).toContain('conduit_cartographer');
        expect(getTraitBuildDraftHintForRelic('chapter_compass')).toBe('Trait build: Conduit Cartographer');
        expect(getTraitBuildDraftHintForRelic('wager_surety')).toBe('Trait build: Cursed Greed');
        expect(getTraitBuildDraftHintForRelic('stray_charge_plus_one')).toBeNull();
    });

    it('derives build guidance from the board trait interactions that are actually present', () => {
        const board = buildBoard(4, { runSeed: 86_001, runRulesVersion: 1 });
        const comboBoard = {
            ...board,
            columns: 2,
            tiles: board.tiles.map((tile, index) =>
                index === 0
                    ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                    : index === 1
                      ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                      : { ...tile, tileTraitKind: undefined }
            )
        };

        expect(getTraitBuildRewardRowsForBoard(comboBoard).map((row) => row.id)[0]).toBe('sealed_catalyst');
        expect(getTraitBuildBoardHint(comboBoard)?.traitKinds).toEqual(['echo', 'sealed']);
        expect(getTraitBuildBoardHint(comboBoard)?.buildLabels[0]).toBe('Sealed Catalyst');
        expect(getTraitBuildDraftHintForBoard(comboBoard)).toBe('Trait build: Sealed Catalyst / Conduit Cartographer');
        expect(
            getTraitBuildRewardRowsForBoard({
                ...comboBoard,
                tiles: comboBoard.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
            })
        ).toEqual([]);
    });

    it('maps starting loadouts to early trait-build guidance', () => {
        expect(getTraitBuildRewardRowsForLoadout('memory_scout').map((row) => row.id)).toEqual([
            'conduit_cartographer',
            'sealed_catalyst'
        ]);
        expect(getTraitBuildRewardRowsForLoadout('route_tactician').map((row) => row.id)).toEqual([
            'conduit_cartographer',
            'drift_routing'
        ]);
        expect(getTraitBuildRewardRowsForLoadout('cursebreaker').map((row) => row.id)).toEqual([
            'mirror_warden',
            'cursed_greed'
        ]);
        expect(getTraitBuildRewardRowsForLoadout('vaultbreaker').map((row) => row.id)).toEqual([
            'sealed_catalyst',
            'cursed_greed'
        ]);
        expect(getTraitBuildRewardRowsForLoadout(null)).toEqual([]);
    });
});
