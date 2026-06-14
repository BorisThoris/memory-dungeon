import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { formatHudActionFeedbackText, useHudPoliteLiveAnnouncement } from './useHudPoliteLiveAnnouncement';

const base = {
    gauntletRemainingMs: null as number | null,
    gauntletActive: false,
    scoreParasiteActive: true,
    parasiteFloors: 0,
    parasiteWardRemaining: 0,
    lives: 3,
    guardTokens: 0,
    comboShards: 0,
    shopGold: 0,
    boardLevel: 1 as number | null,
    boardTiles: [] as Tile[],
    matchedPairs: 0,
    pairCount: 2,
    mismatches: 0,
    tileTraitMatches: {
        echo: 0,
        volatile: 0,
        mirror: 0,
        cursed: 0,
        sealed: 0,
        heavy: 0
    },
    tileTraitMismatches: {
        echo: 0,
        volatile: 0,
        mirror: 0,
        cursed: 0,
        sealed: 0,
        heavy: 0
    },
    volatileTraitShuffles: 0,
    findablesClaimedThisFloor: 0,
    objectiveProgress: 0,
    objectiveRequired: 1,
    objectiveLabel: 'Find the exit',
    recallFocus: 1,
    recallFocusMax: 3,
    recallMatchesThisFloor: 0,
    recallMistakesThisFloor: 0,
    recallBonusScoreThisFloor: 0,
    forgottenTileCountThisFloor: 0,
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
    safeHazardWardsUsedThisFloor: 0,
    dungeonEnemiesDefeatedThisFloor: 0,
    enemyHazardHitsThisFloor: 0,
    enemyHazardsDefeatedThisFloor: 0
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
    it('keeps compact visual action feedback readable for long multi-event updates', () => {
        expect(
            formatHudActionFeedbackText(
                'Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Mirror Decoy misled the mismatch. It cannot form a pair.'
            )
        ).toBe('Shuffle Snare fired. Hidden safe tiles reordered. +4 more updates.');
    });

    it('clips single long visual action feedback without changing live-region copy', () => {
        expect(
            formatHudActionFeedbackText(
                'Memory aid used with an unusually long explanation that would otherwise cover the board and compete with cards for attention.',
                { maxChars: 64 }
            )
        ).toBe('Memory aid used with an unusually long explanation that...');
    });

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
            'Chain times three - consecutive matches boost your score.'
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

    it('announces match, objective, and resource deltas as one readable action summary', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; shards: number; progress: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    comboShards: p.shards,
                    objectiveProgress: p.progress,
                    objectiveRequired: 2,
                    objectiveLabel: 'Disarm traps'
                }),
            { initialProps: { pairs: 0, shards: 0, progress: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, shards: 1, progress: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Disarm traps: 1/2. Combo shard gained. 1 available.'
        );
        expect(result.current.priority).toBe('info');
    });

    it('announces matched tile trait effects with the resolved match', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; echoMatches: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    tileTraitMatches: { ...base.tileTraitMatches, echo: p.echoMatches }
                }),
            { initialProps: { pairs: 0, echoMatches: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, echoMatches: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Match resolved. 1/4 pairs cleared. Echo trait resolved.');
    });

    it('announces tile trait mismatch penalties and volatile shuffles', async () => {
        const { result, rerender } = renderHook(
            (p: { mismatches: number; mirrorMisses: number; shuffles: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    mismatches: p.mismatches,
                    tileTraitMismatches: { ...base.tileTraitMismatches, mirror: p.mirrorMisses },
                    volatileTraitShuffles: p.shuffles
                }),
            { initialProps: { mismatches: 0, mirrorMisses: 0, shuffles: 0 } }
        );

        await act(async () => {
            rerender({ mismatches: 1, mirrorMisses: 1, shuffles: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Cards will turn back. Mirror trait penalty applied. Volatile trait shuffled hidden cards.'
        );
    });

    it('announces recall focus and memory score when a remembered match resolves', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; recallFocus: number; recallMatches: number; recallBonus: number; forgotten?: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus,
                    forgottenTileCountThisFloor: p.forgotten ?? 0
                }),
            { initialProps: { pairs: 0, recallFocus: 1, recallMatches: 0, recallBonus: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, recallFocus: 2, recallMatches: 1, recallBonus: 8 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score.'
        );
    });

    it('announces normalized recall focus when stale run data exceeds the cap', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; recallFocus: number; recallMatches: number; recallBonus: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus
                }),
            { initialProps: { pairs: 0, recallFocus: 99, recallMatches: 0, recallBonus: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, recallFocus: 99, recallMatches: 1, recallBonus: 8 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 3/3; +8 memory score.'
        );
    });

    it('announces when a later match stabilizes forgotten tile memory', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; recallFocus: number; recallMatches: number; recallBonus: number; forgotten: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus,
                    forgottenTileCountThisFloor: p.forgotten
                }),
            { initialProps: { pairs: 0, recallFocus: 0, recallMatches: 0, recallBonus: 0, forgotten: 2 } }
        );

        await act(async () => {
            rerender({ pairs: 1, recallFocus: 1, recallMatches: 1, recallBonus: 0, forgotten: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 1/3. 1 unstable tile memory stabilized.'
        );
    });

    it('announces recall breakage when a miss marks remembered tiles unstable', async () => {
        const { result, rerender } = renderHook(
            (p: { mismatches: number; recallFocus: number; recallMistakes: number; forgotten: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    mismatches: p.mismatches,
                    recallFocus: p.recallFocus,
                    recallMistakesThisFloor: p.recallMistakes,
                    forgottenTileCountThisFloor: p.forgotten
                }),
            { initialProps: { mismatches: 0, recallFocus: 1, recallMistakes: 0, forgotten: 0 } }
        );

        await act(async () => {
            rerender({ mismatches: 1, recallFocus: 0, recallMistakes: 1, forgotten: 2 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Cards will turn back. Recall broken. 2 tile memories are unstable.'
        );
    });

    it('announces life loss before generic mismatch feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; mismatches: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    mismatches: p.mismatches
                }),
            { initialProps: { lives: 3, mismatches: 0 } }
        );

        await act(async () => {
            rerender({ lives: 2, mismatches: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Life lost. 2 lives remain.');
        expect(result.current.priority).toBe('error');
    });

    it('announces guard-token mismatch absorption', async () => {
        const { result, rerender } = renderHook(
            (p: { guards: number; mismatches: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    guardTokens: p.guards,
                    mismatches: p.mismatches
                }),
            { initialProps: { guards: 1, mismatches: 0 } }
        );

        await act(async () => {
            rerender({ guards: 0, mismatches: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Guard token spent. 0 guard tokens remain.');
    });

    it('announces moving enemy contact alongside damage feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; hits: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    enemyHazardHitsThisFloor: p.hits
                }),
            { initialProps: { lives: 3, hits: 0 } }
        );

        await act(async () => {
            rerender({ lives: 2, hits: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Life lost. 2 lives remain. Moving enemy contact.');
        expect(result.current.priority).toBe('error');
    });

    it('announces moving enemy defeats with match feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; defeated: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    enemyHazardsDefeatedThisFloor: p.defeated
                }),
            { initialProps: { pairs: 0, defeated: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, defeated: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Moving enemy defeated. 1 cleared this floor.'
        );
    });

    it('announces dungeon enemy card defeats with match feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { pairs: number; defeated: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    pairCount: 4,
                    matchedPairs: p.pairs,
                    dungeonEnemiesDefeatedThisFloor: p.defeated
                }),
            { initialProps: { pairs: 0, defeated: 0 } }
        );

        await act(async () => {
            rerender({ pairs: 1, defeated: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Dungeon enemy defeated. 1 defeated this floor.'
        );
    });

    it('announces recovery and resource spending deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; guards: number; shards: number; gold: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    guardTokens: p.guards,
                    comboShards: p.shards,
                    shopGold: p.gold
                }),
            { initialProps: { lives: 2, guards: 0, shards: 3, gold: 8 } }
        );

        await act(async () => {
            rerender({ lives: 3, guards: 1, shards: 1, gold: 5 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Life restored. 3 lives available. 2 combo shards spent. 1 available. 3 shop gold spent. 5 available.'
        );
    });

    it('announces guard token gains when no higher-priority health delta is present', async () => {
        const { result, rerender } = renderHook(
            (p: { guards: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    guardTokens: p.guards
                }),
            { initialProps: { guards: 0 } }
        );

        await act(async () => {
            rerender({ guards: 2 });
        });
        await flushRaf();

        expect(result.current.message).toBe('2 guard tokens gained. 2 available.');
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

    it(
        'keeps a pending critical announcement when a lower-priority update arrives during throttle',
        async () => {
            const { result } = renderHook(() =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: null
                })
            );

            await act(async () => {
                result.current.queuePoliteAnnouncement('first', { dedupeKey: 'a', priority: 'info' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('critical hit', { dedupeKey: 'b', priority: 'error' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('minor update', { dedupeKey: 'c', priority: 'info' });
            });
            await flushRaf();

            await act(async () => {
                await new Promise<void>((r) => setTimeout(r, 420));
            });
            expect(result.current.message).toBe('critical hit');
            expect(result.current.priority).toBe('error');
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
