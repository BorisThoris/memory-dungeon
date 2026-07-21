import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import {
    getHazardTileBoardSummary,
    getHazardTileDefinition,
    getHazardTileDefinitions,
    getHazardTileLiveCopies,
    getHazardTileLiveCopy,
    getHazardTileObjectiveBalanceRows,
    getHazardTileObjectiveImpact,
    getHazardTileTelegraph,
    HAZARD_TILE_KINDS,
    previewHazardTileOutcome
} from './hazard-tiles';
import { assertTokenCoverage, calculateMemoryTaxReview } from './mechanic-feedback';

const tile = (id: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey: `pair-${id}`,
    symbol: id.toUpperCase(),
    label: `Tile ${id}`,
    state: 'hidden',
    ...overrides
});

describe('hazard tiles', () => {
    it('keeps the shared hazard catalog complete, telegraphed, and enabled for normal runs', () => {
        const definitions = getHazardTileDefinitions();
        const kinds = definitions.map((definition) => definition.kind);

        expect(kinds).toEqual([...HAZARD_TILE_KINDS]);
        expect(new Set(kinds).size).toBe(kinds.length);
        expect(definitions.every((definition) => definition.prototypeOnly)).toBe(false);
        expect(definitions.every((definition) => definition.enabledInNormalRuns)).toBe(true);
        expect(definitions.every((definition) => definition.canTargetDecoy === false)).toBe(true);
        expect(definitions.every((definition) => definition.canTargetExit === false)).toBe(true);
        expect(definitions.every((definition) => definition.triggerScope.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.telegraph.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.focusHint.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.outcomePreview.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.resultCopy.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.liveAnnouncement.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.reducedMotionLiveAnnouncement.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.objectiveInteraction.length > 20)).toBe(true);
        expect(definitions.every((definition) => definition.targetPolicy.length > 20)).toBe(true);
        expect(definitions.every((definition) => assertTokenCoverage(definition.tokens))).toBe(true);
        expect(definitions.every((definition) => calculateMemoryTaxReview(definition.memoryTax).band !== 'reject_or_defer')).toBe(
            true
        );
    });

    it('returns stable definitions and tile telegraphs without requiring engine state', () => {
        expect(getHazardTileDefinition('mirror_decoy').label).toBe('Mirror Decoy');
        expect(getHazardTileLiveCopy('shuffle_snare')).toMatchObject({
            label: 'Shuffle Snare',
            focusHint: 'Wrong pairs reshuffle safe hidden tiles.',
            liveAnnouncement: 'Shuffle Snare fired. Hidden safe tiles reordered.',
            reducedMotionLiveAnnouncement: 'Shuffle Snare fired. Hidden safe tiles reordered without motion.'
        });
        expect(getHazardTileLiveCopy('fragile_cache')).toMatchObject({
            label: 'Fragile Cache',
            focusHint: 'Clean match pays a bonus; a mismatch breaks the cache.',
            liveAnnouncement: 'Fragile Cache claimed. Bonus score added.',
            breakLiveAnnouncement: 'Fragile Cache broke. Its bonus is gone, but the pair still matches.'
        });
        expect(getHazardTileLiveCopy('toll_cache')).toMatchObject({
            label: 'Toll Cache',
            focusHint: 'Clean match pays shop gold but takes a small score toll.',
            liveAnnouncement: 'Toll Cache claimed. Shop gold gained; score toll paid.'
        });
        expect(getHazardTileLiveCopy('fuse_cache')).toMatchObject({
            label: 'Fuse Cache',
            focusHint: 'Claim in the first three resolutions for full payout.',
            liveAnnouncement: 'Fuse Cache claimed early. Full payout gained.',
            breakLiveAnnouncement: 'Fuse Cache claimed late. Fuse expired; consolation gold gained.'
        });
        expect(getHazardTileTelegraph(tile('plain'))).toEqual({
            hasHazard: false,
            kind: null,
            label: null,
            telegraph: null,
            ariaLabel: null,
            prototypeOnly: false,
            enabledInNormalRuns: false
        });

        expect(getHazardTileTelegraph(tile('hazard', { tileHazardKind: 'cascade_cache' }))).toMatchObject({
            hasHazard: true,
            kind: 'cascade_cache',
            label: 'Cascade Cache',
            telegraph: 'Clean matches clear one safe hidden pair.',
            prototypeOnly: false,
            enabledInNormalRuns: true
        });
    });

    it('maps every v1 hazard to live, reduced-motion, and focus copy', () => {
        const copies = getHazardTileLiveCopies();

        expect(copies.map((copy) => copy.kind)).toEqual([...HAZARD_TILE_KINDS]);
        for (const copy of copies) {
            expect(copy.label.length).toBeGreaterThan(5);
            expect(copy.focusHint.length).toBeGreaterThan(20);
            expect(copy.liveAnnouncement.length).toBeGreaterThan(20);
            expect(copy.reducedMotionLiveAnnouncement.length).toBeGreaterThan(20);
            expect(copy.ariaLabel.length).toBeGreaterThan(20);
            expect(assertTokenCoverage(copy.tokens)).toBe(true);
        }
    });

    it('allows live normal-run previews for enabled hazards', () => {
        expect(
            previewHazardTileOutcome({
                tile: tile('snare', { tileHazardKind: 'shuffle_snare' }),
                trigger: 'mismatch',
                candidateTargetTiles: [tile('target')]
            })
        ).toMatchObject({
            kind: 'shuffle_snare',
            wouldTrigger: true,
            normalRunBlocked: false,
            prototypeOnly: false,
            outcomeKind: 'shuffle_hidden_preview',
            blockedReason: null,
            affectedTileIds: ['target']
        });
    });

    it('guards wrong triggers and missing hazards deterministically', () => {
        expect(previewHazardTileOutcome({ tile: tile('plain'), trigger: 'flip' })).toMatchObject({
            kind: null,
            wouldTrigger: false,
            blockedReason: 'no_hazard'
        });
        expect(
            previewHazardTileOutcome({
                tile: tile('cache', { tileHazardKind: 'cascade_cache' }),
                trigger: 'mismatch'
            })
        ).toMatchObject({
            kind: 'cascade_cache',
            wouldTrigger: false,
            blockedReason: 'wrong_trigger'
        });
    });

    it('previews shuffle snare without ever targeting decoys, exits, or visible cards', () => {
        const preview = previewHazardTileOutcome({
            tile: tile('snare', { tileHazardKind: 'shuffle_snare' }),
            trigger: 'mismatch',
            candidateTargetTiles: [
                tile('safe-a'),
                tile('decoy', { pairKey: '__decoy__' }),
                tile('exit', { dungeonCardKind: 'exit' }),
                tile('enemy', { dungeonCardKind: 'enemy' }),
                tile('route', { routeCardKind: 'greed_cache' }),
                tile('pickup', { findableKind: 'shard_spark' }),
                tile('hazard', { tileHazardKind: 'cascade_cache' }),
                tile('flipped', { state: 'flipped' }),
                tile('safe-b')
            ]
        });

        expect(preview).toMatchObject({
            wouldTrigger: true,
            affectedTileIds: ['safe-a', 'safe-b'],
            skippedUnsafeTargetIds: ['decoy', 'exit', 'enemy', 'route', 'pickup', 'hazard'],
            blockedReason: null,
            invariants: {
                preservesBoardCompletion: true,
                excludesDecoys: true,
                excludesExits: true
            }
        });
    });

    it('derives a board summary for active hazard UI without engine state', () => {
        const summary = getHazardTileBoardSummary({
            level: 1,
            pairCount: 3,
            columns: 3,
            rows: 2,
            tiles: [
                tile('snare-a', { tileHazardKind: 'shuffle_snare' }),
                tile('snare-b', { tileHazardKind: 'shuffle_snare' }),
                tile('cache-a', { tileHazardKind: 'cascade_cache', state: 'matched' }),
                tile('cache-b', { tileHazardKind: 'cascade_cache', state: 'removed' }),
                tile('mirror', { tileHazardKind: 'mirror_decoy', pairKey: '__decoy__' })
            ],
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null
        });

        expect(summary).toMatchObject({
            hasHazards: true,
            totalHazardTiles: 3,
            hudLabel: '3 hazard tiles'
        });
        expect(summary.rows.map((row) => row.kind)).toEqual(['shuffle_snare', 'mirror_decoy']);
        expect(summary.hudDetail).toContain('Shuffle Snare x2');
        expect(summary.hudDetail).toContain('Mirror Decoy x1');
    });

    it('previews cascade and mirror hazards without violating completion invariants', () => {
        expect(
            previewHazardTileOutcome({
                tile: tile('cache', { tileHazardKind: 'cascade_cache' }),
                trigger: 'match',
                candidateTargetTiles: [tile('first'), tile('second'), tile('exit', { dungeonCardKind: 'exit' })]
            })
        ).toMatchObject({
            wouldTrigger: true,
            outcomeKind: 'cascade_remove_preview',
            affectedTileIds: ['first'],
            skippedUnsafeTargetIds: ['exit'],
            blockedReason: null
        });

        expect(
            previewHazardTileOutcome({
                tile: tile('mirror', { tileHazardKind: 'mirror_decoy' }),
                trigger: 'mismatch',
                candidateTargetTiles: [tile('decoy', { pairKey: '__decoy__' })]
            })
        ).toMatchObject({
            wouldTrigger: true,
            outcomeKind: 'decoy_misdirect_preview',
            affectedTileIds: [],
            skippedUnsafeTargetIds: ['decoy'],
            blockedReason: null
        });
    });

    it('previews fragile cache claim and break without targeting other tiles', () => {
        expect(
            previewHazardTileOutcome({
                tile: tile('fragile', { tileHazardKind: 'fragile_cache' }),
                trigger: 'match',
                candidateTargetTiles: [tile('safe')]
            })
        ).toMatchObject({
            kind: 'fragile_cache',
            wouldTrigger: true,
            outcomeKind: 'fragile_cache_preview',
            affectedTileIds: [],
            blockedReason: null
        });

        expect(
            previewHazardTileOutcome({
                tile: tile('fragile', { tileHazardKind: 'fragile_cache' }),
                trigger: 'mismatch',
                candidateTargetTiles: [tile('safe')]
            })
        ).toMatchObject({
            kind: 'fragile_cache',
            wouldTrigger: true,
            outcomeKind: 'fragile_cache_preview',
            affectedTileIds: [],
            blockedReason: null
        });
    });

    it('previews toll cache claim without targeting other tiles', () => {
        expect(
            previewHazardTileOutcome({
                tile: tile('toll', { tileHazardKind: 'toll_cache' }),
                trigger: 'match',
                candidateTargetTiles: [tile('safe')]
            })
        ).toMatchObject({
            kind: 'toll_cache',
            wouldTrigger: true,
            outcomeKind: 'toll_cache_preview',
            affectedTileIds: [],
            blockedReason: null
        });
    });

    it('previews fuse cache claim without targeting other tiles', () => {
        expect(
            previewHazardTileOutcome({
                tile: tile('fuse', { tileHazardKind: 'fuse_cache' }),
                trigger: 'match',
                candidateTargetTiles: [tile('safe')]
            })
        ).toMatchObject({
            kind: 'fuse_cache',
            wouldTrigger: true,
            outcomeKind: 'fuse_cache_preview',
            affectedTileIds: [],
            blockedReason: null
        });
    });

    it('requires any future HazardTileKind to be represented in the catalog', () => {
        const catalog = new Set(getHazardTileDefinitions().map((definition) => definition.kind));

        expect(HAZARD_TILE_KINDS.every((kind) => catalog.has(kind))).toBe(true);
    });

    it('maps every v1 hazard to featured objective, findable, and balance impacts', () => {
        const rows = getHazardTileObjectiveBalanceRows();
        const objectiveIds = ['scholar_style', 'glass_witness', 'cursed_last', 'flip_par', 'findables'] as const;

        expect(rows.map((row) => row.kind)).toEqual([...HAZARD_TILE_KINDS]);
        for (const row of rows) {
            expect(row.pressureNote.length).toBeGreaterThan(20);
            expect(row.rewardNote.length).toBeGreaterThan(20);
            expect(row.memoryNote.length).toBeGreaterThan(20);
            expect(assertTokenCoverage(row.tokens)).toBe(true);
            expect(row.objectiveImpacts.map((impact) => impact.objectiveId)).toEqual([...objectiveIds]);
            for (const impact of row.objectiveImpacts) {
                expect(impact.copy.length).toBeGreaterThan(20);
                expect(assertTokenCoverage(impact.tokens)).toBe(true);
            }
        }
    });

    it('names the product-critical hazard objective edge cases', () => {
        expect(getHazardTileObjectiveImpact('cascade_cache', 'cursed_last')).toMatchObject({
            impact: 'blocked_target'
        });
        expect(getHazardTileObjectiveImpact('cascade_cache', 'findables')).toMatchObject({
            impact: 'blocked_target'
        });
        expect(getHazardTileObjectiveImpact('mirror_decoy', 'glass_witness')).toMatchObject({
            impact: 'can_forfeit'
        });
        expect(getHazardTileObjectiveImpact('shuffle_snare', 'scholar_style')).toMatchObject({
            impact: 'preserves'
        });
        expect(getHazardTileObjectiveImpact('fragile_cache', 'flip_par')).toMatchObject({
            impact: 'can_forfeit'
        });
        expect(getHazardTileObjectiveImpact('toll_cache', 'findables')).toMatchObject({
            impact: 'preserves'
        });
    });
});
