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
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' }),
            tile('plain-a', 'plain'),
            tile('plain-b', 'plain')
        ]);

        const summary = getTraitOpportunitySummary(b);

        // Heavy previews nothing of its own; it is listed because the Conduit beside it pays for it.
        expect(summary.tiles.map((row) => row.tileId)).toEqual(['conduit-a', 'heavy-a']);
        expect(summary.tiles.map((row) => row.label)).toEqual(['conduit-a', 'heavy-a']);
        expect(summary.interactionLines).toEqual(['Conduit: adjacent trait charge']);
        expect(summary.reason).toContain('Offered for current trait route');
        expect([...getTraitOpportunityTileIds(b)]).toEqual(['conduit-a', 'heavy-a']);
        expect([...getTraitComboSurgeTileIds(b)]).toEqual([]);
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            buildLabel: '2 combo-ready cards',
            headline: 'Chain route ready',
            primaryLine: 'Conduit: adjacent trait charge',
            secondaryLine: null,
            tileIds: ['conduit-a', 'heavy-a'],
            tone: 'ready'
        });
    });

    it('marks trait opportunities as combo-surge cards when multiple route interactions are live', () => {
        const b = board([
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('stasis-a', 'stasis', { tileTraitKind: 'stasis' }),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitOpportunitySummary(b).interactionLines).toEqual([
            'Conduit: adjacent trait charge',
            'Conduit + Echo: peek spark',
            'Conduit + Stasis: lock pulse'
        ]);
        // Heavy sits beside Echo and Stasis, neither of which previews anything, so it stays unlit.
        expect([...getTraitComboSurgeTileIds(b)]).toEqual(['conduit-a', 'echo-a', 'stasis-a']);
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            headline: 'Combo surge ready',
            primaryLine: 'Conduit: adjacent trait charge',
            secondaryLine: 'Conduit + Echo: peek spark',
            tone: 'surge'
        });
    });

    it('builds a compact HUD model with route count, first route, and routing tools', () => {
        const model = getTraitOpportunityHudModel(
            board([
                tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
                tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
            ]),
            {
                peekCharges: 1,
                regionShuffleCharges: 2,
                shuffleCharges: 0
            }
        );

        expect(model).toMatchObject({
            active: true,
            buildLabel: '2 combo-ready cards',
            primaryLine: 'Conduit: adjacent trait charge',
            routeCountLabel: '1 route',
            toolLine: 'Tools: row/swap 2, peek 1, shuffle 0'
        });
        expect(model.title).toContain('Routes: Conduit: adjacent trait charge.');
    });

    it('finds swap hints that would create new trait routes when routing tools are available', () => {
        const b = board([
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitSwapRouteHints(b, 1)).toEqual([
            {
                firstTileId: 'conduit-a',
                secondTileId: 'plain-a',
                firstLabel: 'conduit-a',
                secondLabel: 'plain-a',
                createdLines: ['Conduit: adjacent trait charge'],
                brokenLines: [],
                text: 'Swap conduit-a with plain-a: Conduit: adjacent trait charge'
            }
        ]);
        expect(
            getTraitOpportunityHudModel(b, {
                peekCharges: 0,
                regionShuffleCharges: 1,
                shuffleCharges: 0
            })
        ).toMatchObject({
            active: true,
            buildLabel: 'Route prime',
            primaryLine: 'Swap conduit-a with plain-a: Conduit: adjacent trait charge',
            routeCountLabel: 'setup',
            title: expect.stringContaining('Swap hint: Swap conduit-a with plain-a: Conduit: adjacent trait charge.')
        });
        expect(getTraitOpportunityHighlight(b)).toMatchObject({
            active: true,
            buildLabel: 'Route prime',
            headline: 'One swap primes route',
            primaryLine: 'Swap conduit-a with plain-a: Conduit: adjacent trait charge',
            secondaryLine: null,
            tileIds: ['conduit-a', 'plain-a'],
            tone: 'setup'
        });
    });

    it('does not advertise swap-created setup routes when a no-shuffle contract locks row/swap tools', () => {
        const b = board([
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        const model = getTraitOpportunityHudModel(b, {
            activeContract: { maxMismatches: null, noDestroy: false, noShuffle: true },
            peekCharges: 0,
            regionShuffleCharges: 1,
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
            tile('conduit-a', 'conduit', { state: 'matched', tileTraitKind: 'conduit' }),
            tile('echo-a', 'echo', { state: 'removed', tileTraitKind: 'echo' })
        ]);

        expect(getTraitOpportunitySummary(b)).toEqual({
            tiles: [],
            interactionLines: [],
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
            tile('conduit-a', 'conduit', { state: 'flipped', tileTraitKind: 'conduit' }),
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('conduit-b', 'conduit', { tileTraitKind: 'conduit' }),
            tile('plain-a', 'plain')
        ]);

        expect([...getSelectedTraitFollowupTileIds({ ...b, flippedTileIds: ['conduit-a'] })]).toEqual(['conduit-b']);
        expect([...getSelectedTraitFollowupTileIds({ ...b, flippedTileIds: [] })]).toEqual([]);
        expect([
            ...getSelectedTraitFollowupTileIds({
                ...b,
                flippedTileIds: ['plain-a'],
                tiles: b.tiles.map((row) => (row.id === 'plain-a' ? { ...row, state: 'flipped' as const } : row))
            })
        ]).toEqual([]);
        expect([
            ...getSelectedTraitFollowupTileIds({
                ...b,
                flippedTileIds: Number.NaN as unknown as string[]
            })
        ]).toEqual([]);
    });

    it('explains whether a tile swap creates or breaks a trait route', () => {
        const b = board([
            tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitSwapOpportunityPreview(b, 'origin-a', 'conduit-a')).toMatchObject({
            createdLines: ['Conduit: adjacent trait charge'],
            routeText: 'Creates trait route: Conduit: adjacent trait charge'
        });
        expect(
            getTraitSwapOpportunityPreview(
                board([
                    tile('conduit-a', 'conduit', { tileTraitKind: 'conduit' }),
                    tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' }),
                    tile('plain-a', 'plain'),
                    tile('plain-b', 'plain')
                ]),
                'heavy-a',
                'plain-b'
            ).routeText
        ).toBe('Breaks trait route: Conduit: adjacent trait charge');
    });

    it('offers no swap hint when no arrangement of the traits on the board lights a route', () => {
        // Echo and Heavy pay on their own match; with no Conduit or Stasis there is nothing to prime.
        const b = board([
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('plain-a', 'plain'),
            tile('origin-a', 'origin'),
            tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
        ]);

        expect(getTraitSwapRouteHints(b, 3)).toEqual([]);
        expect(getTraitSwapOpportunityPreview(b, 'plain-a', 'echo-a')).toMatchObject({
            createdLines: [],
            routeText: null
        });
    });
});
