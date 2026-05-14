import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { useHudPoliteLiveAnnouncement } from './useHudPoliteLiveAnnouncement';

const base = {
    gauntletRemainingMs: null as number | null,
    gauntletActive: false,
    scoreParasiteActive: true,
    parasiteFloors: 0,
    parasiteWardRemaining: 0,
    lives: 3,
    boardLevel: 1 as number | null,
    boardTiles: [] as Tile[],
    findablesClaimedThisFloor: 0,
    chainMatchStreak: 0,
    chainAnnounceActive: false,
    gambitThirdPickActive: false,
    gambitOpportunityFlippedIds: null as readonly string[] | null,
    reduceMotion: false,
    hazardTileTriggersThisFloor: 0,
    hazardShuffleSnaresThisFloor: 0,
    hazardCascadeCachesThisFloor: 0,
    hazardMirrorDecoysThisFloor: 0,
    hazardFragileCacheClaimsThisFloor: 0,
    hazardFragileCacheBreaksThisFloor: 0,
    hazardTollCachesThisFloor: 0,
    hazardFuseCachesThisFloor: 0,
    hazardFuseCacheExpiredClaimsThisFloor: 0,
    lanternWardScoutsThisFloor: 0,
    omenSealScoutsThisFloor: 0,
    mimicCacheClaimsThisFloor: 0,
    mimicCacheBitesThisFloor: 0,
    mimicCacheGuardBitesThisFloor: 0,
    safeHazardWardsUsedThisFloor: 0
};

const flushRaf = async (): Promise<void> => {
    await act(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        await Promise.resolve();
    });
};

describe('useHudPoliteLiveAnnouncement', () => {

    it('announces when gauntlet crosses the sixty-second bucket', async () => {
        const { result, rerender } = renderHook(
            (p: { ms: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gauntletActive: true,
                    gauntletRemainingMs: p.ms
                }),
            { initialProps: { ms: 90_000 } }
        );
        expect(result.current.message).toBe('');
        rerender({ ms: 90_000 });
        expect(result.current.message).toBe('');
        await act(async () => {
            rerender({ ms: 59_000 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Gauntlet: one minute or less remaining.');
    });

    it('announces score parasite one-floor-before-drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf
                }),
            { initialProps: { level: 3, pf: 2 } }
        );
        await act(async () => {
            rerender({ level: 4, pf: 3 });
        });
        await flushRaf();
        expect(result.current.message).toBe(
            'Score parasite: next cleared floor triggers the drain unless warded.'
        );
    });

    it('announces score parasite life drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number; lives: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf,
                    lives: p.lives
                }),
            { initialProps: { level: 4, pf: 3, lives: 3 } }
        );
        await act(async () => {
            rerender({ level: 5, pf: 0, lives: 2 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Score parasite drained one life.');
    });

    it('announces ward absorbing parasite drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number; ward: number; lives: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf,
                    parasiteWardRemaining: p.ward,
                    lives: p.lives
                }),
            { initialProps: { level: 4, pf: 3, ward: 1, lives: 3 } }
        );
        await act(async () => {
            rerender({ level: 5, pf: 0, ward: 0, lives: 3 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Score parasite drain absorbed by ward.');
    });

    it('announces match chain milestones while playing', async () => {
        const { result, rerender } = renderHook(
            (p: { streak: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 3,
                    chainAnnounceActive: true,
                    chainMatchStreak: p.streak
                }),
            { initialProps: { streak: 2 } }
        );

        await act(async () => {
            rerender({ streak: 3 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Chain times three — consecutive matches boost your score.'
        );
    });

    it('announces pickup claims with reward-specific copy', async () => {
        const beforeTiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', findableKind: 'shard_spark' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', findableKind: 'shard_spark' }
        ];
        const afterTiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'matched' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'matched' }
        ];

        const { result, rerender } = renderHook(
            (p: { tiles: Tile[]; claimed: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTiles: p.tiles,
                    findablesClaimedThisFloor: p.claimed
                }),
            { initialProps: { tiles: beforeTiles, claimed: 0 } }
        );

        await act(async () => {
            rerender({ tiles: afterTiles, claimed: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Shard spark claimed: +1 combo shard.');
    });

    it('announces hazard tile trigger deltas in a stable order', async () => {
        const { result, rerender } = renderHook(
            (p: {
                total: number;
                snare: number;
                cascade: number;
                mirror: number;
                fragileClaim: number;
                fragileBreak: number;
                toll: number;
                fuse: number;
                fuseExpired: number;
            }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    hazardTileTriggersThisFloor: p.total,
                    hazardShuffleSnaresThisFloor: p.snare,
                    hazardCascadeCachesThisFloor: p.cascade,
                    hazardMirrorDecoysThisFloor: p.mirror,
                    hazardFragileCacheClaimsThisFloor: p.fragileClaim,
                    hazardFragileCacheBreaksThisFloor: p.fragileBreak,
                    hazardTollCachesThisFloor: p.toll,
                    hazardFuseCachesThisFloor: p.fuse,
                    hazardFuseCacheExpiredClaimsThisFloor: p.fuseExpired
                }),
            { initialProps: { total: 0, snare: 0, cascade: 0, mirror: 0, fragileClaim: 0, fragileBreak: 0, toll: 0, fuse: 0, fuseExpired: 0 } }
        );

        await act(async () => {
            rerender({ total: 7, snare: 1, cascade: 1, mirror: 1, fragileClaim: 1, fragileBreak: 1, toll: 1, fuse: 1, fuseExpired: 0 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Mirror Decoy misled the mismatch. It cannot form a pair. Fragile Cache claimed. Bonus score added. Fragile Cache broke. Its bonus is gone, but the pair still matches. Toll Cache claimed. Shop gold gained; score toll paid. Fuse Cache claimed early. Full payout gained.'
        );
    });

    it('announces late Fuse Cache claims with expired-fuse copy', async () => {
        const { result, rerender } = renderHook(
            (p: { total: number; fuse: number; fuseExpired: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    hazardTileTriggersThisFloor: p.total,
                    hazardFuseCachesThisFloor: p.fuse,
                    hazardFuseCacheExpiredClaimsThisFloor: p.fuseExpired
                }),
            { initialProps: { total: 0, fuse: 0, fuseExpired: 0 } }
        );

        await act(async () => {
            rerender({ total: 1, fuse: 1, fuseExpired: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Fuse Cache claimed late. Fuse expired; consolation gold gained.');
    });

    it('uses reduced-motion copy for hazard tile trigger announcements', async () => {
        const { result, rerender } = renderHook(
            (p: { total: number; snare: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    reduceMotion: true,
                    hazardTileTriggersThisFloor: p.total,
                    hazardShuffleSnaresThisFloor: p.snare
                }),
            { initialProps: { total: 0, snare: 0 } }
        );

        await act(async () => {
            rerender({ total: 1, snare: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Shuffle Snare fired. Hidden safe tiles reordered without motion.'
        );
    });

    it('announces lantern ward scout deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { scouts: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    lanternWardScoutsThisFloor: p.scouts
                }),
            { initialProps: { scouts: 0 } }
        );

        await act(async () => {
            rerender({ scouts: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Lantern Ward scouted a hidden threat.');
    });

    it('announces omen seal scout deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { scouts: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    omenSealScoutsThisFloor: p.scouts
                }),
            { initialProps: { scouts: 0 } }
        );

        await act(async () => {
            rerender({ scouts: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Omen Seal revealed hidden danger.');
    });

    it('announces controlled mimic cache claims', async () => {
        const { result, rerender } = renderHook(
            (p: { claims: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    mimicCacheClaimsThisFloor: p.claims
                }),
            { initialProps: { claims: 0 } }
        );

        await act(async () => {
            rerender({ claims: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Mimic Cache controlled. Full loot claimed.');
    });

    it('announces mimic cache guard bites before generic life bites', async () => {
        const { result, rerender } = renderHook(
            (p: { bites: number; guardBites: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    mimicCacheClaimsThisFloor: p.bites,
                    mimicCacheBitesThisFloor: p.bites,
                    mimicCacheGuardBitesThisFloor: p.guardBites
                }),
            { initialProps: { bites: 0, guardBites: 0 } }
        );

        await act(async () => {
            rerender({ bites: 1, guardBites: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Mimic Cache bit. Guard absorbed the hit.');
    });

    it('announces Guard Cache ward blocks', async () => {
        const { result, rerender } = renderHook(
            (p: { wardsUsed: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    safeHazardWardsUsedThisFloor: p.wardsUsed
                }),
            { initialProps: { wardsUsed: 0 } }
        );

        await act(async () => {
            rerender({ wardsUsed: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Guard Cache ward blocked a hazard.');
    });

    it('does not announce existing hazard counters on first render or reset', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; total: number; cascade: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardLevel: p.level,
                    hazardTileTriggersThisFloor: p.total,
                    hazardCascadeCachesThisFloor: p.cascade
                }),
            { initialProps: { level: 1, total: 1, cascade: 1 } }
        );

        await flushRaf();
        expect(result.current.message).toBe('');

        await act(async () => {
            rerender({ level: 2, total: 0, cascade: 0 });
        });
        await flushRaf();

        expect(result.current.message).toBe('');
    });

    it('dedupes announcements with the same key in one rAF flush', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('a', { dedupeKey: 'k', priority: 'info' });
            result.current.queuePoliteAnnouncement('b', { dedupeKey: 'k', priority: 'info' });
        });
        await flushRaf();

        expect(result.current.message).toBe('b');
    });

    it('prefers higher priority when dedupe key matches', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('info-text', { dedupeKey: 'x', priority: 'info' });
            result.current.queuePoliteAnnouncement('error-text', { dedupeKey: 'x', priority: 'error' });
        });
        await flushRaf();

        expect(result.current.message).toBe('error-text');
    });

    it('does not downgrade priority when a lower priority shares a dedupe key', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('error-text', { dedupeKey: 'x', priority: 'error' });
            result.current.queuePoliteAnnouncement('info-text', { dedupeKey: 'x', priority: 'info' });
        });
        await flushRaf();

        expect(result.current.message).toBe('error-text');
    });

    it(
        'throttles rapid successive deliveries (min gap between live-region updates)',
        async () => {
            const { result } = renderHook(() =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: null
                })
            );

            await act(async () => {
                result.current.queuePoliteAnnouncement('first', { dedupeKey: 'a' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('second', { dedupeKey: 'b' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                await new Promise<void>((r) => setTimeout(r, 420));
            });
            expect(result.current.message).toBe('second');
        },
        10_000
    );

    it('announces Gambit third-flip opportunity when the window opens', async () => {
        const { result, rerender } = renderHook(
            (p: { active: boolean; ids: readonly string[] | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    scoreParasiteActive: false,
                    gambitThirdPickActive: p.active,
                    gambitOpportunityFlippedIds: p.ids
                }),
            { initialProps: { active: false, ids: null as readonly string[] | null } }
        );
        await act(async () => {
            rerender({ active: true, ids: ['tile-a', 'tile-b'] });
        });
        await flushRaf();
        expect(result.current.message).toBe(GAMBIT_OPPORTUNITY_HINT_LINE);
    });
});
