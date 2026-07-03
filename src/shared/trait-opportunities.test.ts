import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    getTraitComboSurgeTileIds,
    getTraitOpportunityHighlight,
    getTraitOpportunityHudModel,
    getSelectedTraitFollowupTileIds,
    getTraitOpportunitySummary,
    getTraitOpportunityTileIds,
    getTraitSwapRouteHints,
    getTraitSwapOpportunityPreview
} from './trait-opportunities';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...overrides
});

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        pairCount: Math.floor(tiles.length / 2),
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        floorArchetypeId: null
    }) as unknown as BoardState;

describe('trait opportunities', () => {
    it('summarizes actionable trait tiles, interaction lines, build labels, and reward reason', () => {
        const b = board([
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('plain-b', 'plain')
        ]);

        const summary = getTraitOpportunitySummary(b);

        expect(summary.tiles.map((row) => row.tileId)).toEqual(['echo-a', 'sealed-a']);
        expect(summary.tiles.map((row) => row.label)).toEqual(['echo-a', 'sealed-a']);
        expect(summary.interactionLines).toEqual(expect.arrayContaining(['Echo + Sealed: combo shard']));
        expect(summary.buildLabels[0]).toBe('Sealed Catalyst');
        expect(summary.reason).toContain('Offered for Sealed Catalyst');
        expect([...getTraitOpportunityTileIds(b)]).toEqual(['echo-a', 'sealed-a']);
        expect([...getTraitComboSurgeTileIds(b)]).toEqual([]);
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            buildLabel: 'Sealed Catalyst',
            headline: 'Chain route ready',
            primaryLine: 'Echo + Sealed: combo shard',
            secondaryLine: null,
            tileIds: ['echo-a', 'sealed-a'],
            tone: 'ready'
        });
    });

    it('marks trait opportunities as combo-surge cards when multiple route interactions are live', () => {
        const b = board([
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('mirror-a', 'mirror', { tileTraitKind: 'mirror' }),
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' })
        ]);

        expect(getTraitOpportunitySummary(b).interactionLines).toEqual(
            expect.arrayContaining(['Echo + Sealed: combo shard', 'Sealed + Conduit: shard spark'])
        );
        expect([...getTraitComboSurgeTileIds(b)]).toEqual(['echo-a', 'sealed-a', 'mirror-a', 'conduit-a']);
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            headline: 'Combo surge ready',
            primaryLine: 'Echo + Sealed: combo shard',
            secondaryLine: 'Echo + Mirror: recall focus',
            tone: 'surge'
        });
    });

    it('builds a compact HUD model with route count, first route, and routing tools', () => {
        const model = getTraitOpportunityHudModel(
            board([
                tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
                tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' })
            ]),
            {
                peekCharges: 1,
                regionShuffleCharges: 2,
                regionShuffleFreeThisFloor: true,
                shuffleCharges: 0
            }
        );

        expect(model).toMatchObject({
            active: true,
            buildLabel: 'Sealed Catalyst',
            primaryLine: 'Echo + Sealed: combo shard',
            routeCountLabel: '1 route',
            toolLine: 'Tools: row/swap 2 + free, peek 1, shuffle 0'
        });
        expect(model.title).toContain('Routes: Echo + Sealed: combo shard.');
    });

    it('finds swap hints that would create new trait routes when routing tools are available', () => {
        const b = board([
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitSwapRouteHints(b, 1)).toEqual([
            {
                firstTileId: 'sealed-a',
                secondTileId: 'plain-a',
                firstLabel: 'sealed-a',
                secondLabel: 'plain-a',
                createdLines: ['Sealed + Heavy: score surge'],
                matchCreatedLines: ['Sealed + Heavy: score surge'],
                brokenLines: [],
                text: 'Swap sealed-a with plain-a: Sealed + Heavy: score surge'
            }
        ]);
        expect(
            getTraitOpportunityHudModel(b, {
                peekCharges: 0,
                regionShuffleCharges: 1,
                regionShuffleFreeThisFloor: false,
                shuffleCharges: 0
            })
        ).toMatchObject({
            active: true,
            buildLabel: 'Route prime',
            primaryLine: 'Swap sealed-a with plain-a: Sealed + Heavy: score surge',
            routeCountLabel: 'setup',
            title: expect.stringContaining('Swap hint: Swap sealed-a with plain-a: Sealed + Heavy: score surge.')
        });
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            buildLabel: 'Route prime',
            headline: 'One swap primes route',
            primaryLine: 'Swap sealed-a with plain-a: Sealed + Heavy: score surge',
            secondaryLine: null,
            tileIds: ['sealed-a', 'plain-a'],
            tone: 'setup'
        });
    });

    it('does not advertise swap-created setup routes when a no-shuffle contract locks row/swap tools', () => {
        const b = board([
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        const model = getTraitOpportunityHudModel(b, {
            activeContract: { maxMismatches: null, noDestroy: false, noShuffle: true },
            peekCharges: 0,
            regionShuffleCharges: 1,
            regionShuffleFreeThisFloor: true,
            shuffleCharges: 0
        });

        expect(model).toMatchObject({
            active: false,
            primaryLine: 'No trait route primed yet',
            routeCountLabel: '0 routes',
            swapHint: null,
            toolLine: 'Tools: row/swap locked, peek 0, shuffle 0'
        });
        expect(model.title).not.toContain('Swap hint:');
    });

    it('ignores matched and removed trait cards so stale combos do not drive rewards', () => {
        const b = board([
            tile('echo-a', 'echo', { state: 'matched', tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', { state: 'removed', tileTraitKind: 'sealed' })
        ]);

        expect(getTraitOpportunitySummary(b)).toEqual({
            tiles: [],
            interactionLines: [],
            buildLabels: [],
            reason: null
        });
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: false,
            headline: 'No chain route lit',
            tileIds: [],
            tone: 'idle'
        });
    });

    it('marks hidden mate cards as selected trait followups after one comboable trait card is flipped', () => {
        const b = board([
            tile('echo-a', 'echo', { state: 'flipped', tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('echo-b', 'echo', { tileTraitKind: 'echo' }),
            tile('plain-a', 'plain')
        ]);

        expect([...getSelectedTraitFollowupTileIds({ ...b, flippedTileIds: ['echo-a'] })]).toEqual(['echo-b']);
        expect([...getSelectedTraitFollowupTileIds({ ...b, flippedTileIds: [] })]).toEqual([]);
        expect([
            ...getSelectedTraitFollowupTileIds({
                ...b,
                flippedTileIds: ['plain-a'],
                tiles: b.tiles.map((row) => (row.id === 'plain-a' ? { ...row, state: 'flipped' as const } : row))
            })
        ]).toEqual([]);
    });

    it('explains whether a tile swap creates or breaks a trait route', () => {
        const b = board([
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitSwapOpportunityPreview(b, 'origin-a', 'sealed-a')).toMatchObject({
            createdLines: ['Sealed + Heavy: score surge'],
            matchCreatedLines: ['Sealed + Heavy: score surge'],
            routeText: 'Creates trait route: Sealed + Heavy: score surge'
        });
        expect(
            getTraitSwapOpportunityPreview(
                board([
                    tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
                    tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
                    tile('plain-a', 'plain'),
                    tile('plain-b', 'plain')
                ]),
                'sealed-a',
                'plain-b'
            ).routeText
        ).toBe('Breaks trait route: Echo + Sealed: combo shard');
    });

    it('does not offer proactive swap hints for mismatch-only route creation', () => {
        const b = board([
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('stasis-a', 'stasis', { tileTraitKind: 'stasis' })
        ]);

        expect(getTraitSwapOpportunityPreview(b, 'plain-a', 'sealed-a')).toMatchObject({
            createdLines: ['Stasis buffered Sealed'],
            matchCreatedLines: []
        });
        expect(getTraitSwapRouteHints(b, 1)).toEqual([]);
    });
});
