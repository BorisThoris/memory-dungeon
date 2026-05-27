import { useCallback, useEffect, useRef, useState } from 'react';
import type { FindableKind, HazardTileKind, Tile } from '../../shared/contracts';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { getHazardTileLiveCopy } from '../../shared/hazard-tiles';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';

const GAUNTLET_WARN_SECS = [60, 30, 10, 5] as const;

const gauntletMessageForThreshold = (secs: number): string => {
    if (secs <= 5) {
        return 'Gauntlet: five seconds or less remaining.';
    }
    if (secs <= 10) {
        return 'Gauntlet: ten seconds or less remaining.';
    }
    if (secs <= 30) {
        return 'Gauntlet: thirty seconds or less remaining.';
    }
    return 'Gauntlet: one minute or less remaining.';
};

const flushThenSet = (text: string, set: (value: string) => void): void => {
    set('');
    queueMicrotask(() => {
        set(text);
    });
};

/** Min interval between polite live-region updates (anti-spam for screen readers). */
const POLITE_HUD_THROTTLE_MS = 400;

type HudAnnouncePriority = 'info' | 'error';

const PRIORITY_RANK: Record<HudAnnouncePriority, number> = { error: 2, info: 1 };

export const detectClaimedFindableKind = (
    previousTiles: readonly Tile[],
    nextTiles: readonly Tile[]
): FindableKind | null => {
    const previousKinds = new Map<string, FindableKind>();
    for (const tile of previousTiles) {
        if (tile.findableKind != null) {
            previousKinds.set(tile.pairKey, tile.findableKind);
        }
    }
    for (const [pairKey, kind] of previousKinds) {
        const nextPairTiles = nextTiles.filter((tile) => tile.pairKey === pairKey);
        if (
            nextPairTiles.length > 0 &&
            nextPairTiles.every(
                (tile) =>
                    (tile.state === 'matched' || tile.state === 'removed') &&
                    tile.findableKind == null
            )
        ) {
            return kind;
        }
    }
    return null;
};

const getFindableAnnouncementText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} claimed: ${getFindableRewardCopy(kind)}.`;

export const getFindableToastText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} ${getFindableRewardCopy(kind)}`;

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;

const splitHudAnnouncementSentences = (text: string): string[] =>
    text
        .replace(/\s+/g, ' ')
        .trim()
        .match(/[^.?!]+[.?!]?/g)
        ?.map((part) => part.trim())
        .filter(Boolean) ?? [];

export const formatHudActionFeedbackText = (
    text: string,
    { maxChars = 132, maxSentences = 2 }: { maxChars?: number; maxSentences?: number } = {}
): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
        return normalized;
    }

    const sentences = splitHudAnnouncementSentences(normalized);
    if (sentences.length > 1) {
        const selected: string[] = [];
        for (const sentence of sentences) {
            if (selected.length >= maxSentences) {
                break;
            }
            const next = [...selected, sentence].join(' ');
            if (next.length > maxChars && selected.length > 0) {
                break;
            }
            selected.push(sentence);
        }
        const remaining = Math.max(0, sentences.length - selected.length);
        const summary = selected.join(' ');
        return remaining > 0 ? `${summary} +${remaining} more updates.` : summary;
    }

    const clipped = normalized.slice(0, maxChars - 3).replace(/\s+\S*$/, '').trim();
    return `${clipped}...`;
};

const resourceDeltaCopy = (
    delta: number,
    displayLabel: string,
    countedLabel: string,
    verb: 'gained' | 'spent',
    countedPlural = `${countedLabel}s`
): string => {
    const amount = Math.abs(delta);
    return amount === 1 ? `${displayLabel} ${verb}` : `${pluralize(amount, countedLabel, countedPlural)} ${verb}`;
};

interface HudPoliteLiveAnnouncementInput {
    gauntletRemainingMs: number | null;
    gauntletActive: boolean;
    scoreParasiteActive: boolean;
    parasiteFloors: number;
    parasiteWardRemaining: number;
    lives: number;
    guardTokens: number;
    comboShards: number;
    shopGold: number;
    boardLevel: number | null;
    boardTiles: readonly Tile[];
    matchedPairs: number;
    pairCount: number;
    mismatches: number;
    findablesClaimedThisFloor: number;
    objectiveProgress?: number;
    objectiveRequired?: number;
    objectiveLabel?: string | null;
    recallFocus?: number;
    recallFocusMax?: number;
    recallMatchesThisFloor?: number;
    recallMistakesThisFloor?: number;
    recallBonusScoreThisFloor?: number;
    forgottenTileCountThisFloor?: number;
    /** Current consecutive-match streak (run stats). */
    chainMatchStreak: number;
    /** When false, chain milestone announcements are suppressed (e.g. memorize or menus). */
    chainAnnounceActive: boolean;
    /** Gambit third-flip window (two tiles face-up, mismatch resolving). */
    gambitThirdPickActive: boolean;
    /** Flipped tile ids when Gambit is offered (length 2); used for dedupe keys. */
    gambitOpportunityFlippedIds: readonly string[] | null;
    /** Motion setting for hazard effect announcement copy. */
    reduceMotion?: boolean;
    hazardTileTriggersThisFloor?: number;
    hazardShuffleSnaresThisFloor?: number;
    hazardCascadeCachesThisFloor?: number;
    hazardMirrorDecoysThisFloor?: number;
    hazardFragileCacheClaimsThisFloor?: number;
    hazardFragileCacheBreaksThisFloor?: number;
    hazardTollCachesThisFloor?: number;
    hazardFuseCachesThisFloor?: number;
    hazardFuseCacheExpiredClaimsThisFloor?: number;
    lanternWardScoutsThisFloor?: number;
    omenSealScoutsThisFloor?: number;
    mimicCacheClaimsThisFloor?: number;
    mimicCacheBitesThisFloor?: number;
    mimicCacheGuardBitesThisFloor?: number;
    anchorSealUsesThisFloor?: number;
    loadedGatewayPlansThisFloor?: number;
    catalystAltarUpgradesThisFloor?: number;
    parasiteVesselConversionsThisFloor?: number;
    pinLatticeRewardsThisFloor?: number;
    safeHazardWardsUsedThisFloor?: number;
    dungeonEnemiesDefeatedThisFloor?: number;
    enemyHazardHitsThisFloor?: number;
    enemyHazardsDefeatedThisFloor?: number;
}

interface UseHudPoliteLiveAnnouncementResult {
    message: string;
    priority: HudAnnouncePriority;
    queuePoliteAnnouncement: (text: string, opts?: { dedupeKey?: string; priority?: HudAnnouncePriority }) => void;
}

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const normalizeRecallFocusForAnnouncement = (focus: number, max: number): number => {
    const boundedMax = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 3;
    if (!Number.isFinite(focus)) {
        return 0;
    }
    return Math.min(boundedMax, Math.max(0, Math.floor(focus)));
};

/**
 * HUD-015: polite `aria-live` source text for gauntlet deadline buckets and score-parasite milestones.
 * Batches concurrent announcements on `requestAnimationFrame`, dedupes by key, prefers higher priority,
 * and throttles display cadence so screen readers get summaries, not chatter.
 */
const CHAIN_MILESTONE_THRESHOLDS = [3, 5, 8] as const;
const HAZARD_ANNOUNCEMENT_ORDER = ['shuffle_snare', 'cascade_cache', 'mirror_decoy', 'fragile_cache', 'toll_cache', 'fuse_cache'] as const satisfies readonly HazardTileKind[];

export const useHudPoliteLiveAnnouncement = ({
    gauntletRemainingMs,
    gauntletActive,
    scoreParasiteActive,
    parasiteFloors,
    parasiteWardRemaining,
    lives,
    guardTokens,
    comboShards,
    shopGold,
    boardLevel,
    boardTiles,
    matchedPairs,
    pairCount,
    mismatches,
    findablesClaimedThisFloor,
    objectiveProgress = 0,
    objectiveRequired = 0,
    objectiveLabel = null,
    recallFocus = 0,
    recallFocusMax = 3,
    recallMatchesThisFloor = 0,
    recallMistakesThisFloor = 0,
    recallBonusScoreThisFloor = 0,
    forgottenTileCountThisFloor = 0,
    chainMatchStreak,
    chainAnnounceActive,
    gambitThirdPickActive,
    gambitOpportunityFlippedIds,
    reduceMotion = false,
    hazardTileTriggersThisFloor = 0,
    hazardShuffleSnaresThisFloor = 0,
    hazardCascadeCachesThisFloor = 0,
    hazardMirrorDecoysThisFloor = 0,
    hazardFragileCacheClaimsThisFloor = 0,
    hazardFragileCacheBreaksThisFloor = 0,
    hazardTollCachesThisFloor = 0,
    hazardFuseCachesThisFloor = 0,
    hazardFuseCacheExpiredClaimsThisFloor = 0,
    lanternWardScoutsThisFloor = 0,
    omenSealScoutsThisFloor = 0,
    mimicCacheClaimsThisFloor = 0,
    mimicCacheBitesThisFloor = 0,
    mimicCacheGuardBitesThisFloor = 0,
    anchorSealUsesThisFloor = 0,
    loadedGatewayPlansThisFloor = 0,
    catalystAltarUpgradesThisFloor = 0,
    parasiteVesselConversionsThisFloor = 0,
    pinLatticeRewardsThisFloor = 0,
    safeHazardWardsUsedThisFloor = 0,
    dungeonEnemiesDefeatedThisFloor = 0,
    enemyHazardHitsThisFloor = 0,
    enemyHazardsDefeatedThisFloor = 0
}: HudPoliteLiveAnnouncementInput): UseHudPoliteLiveAnnouncementResult => {
    const [message, setMessage] = useState('');
    const [messagePriority, setMessagePriority] = useState<HudAnnouncePriority>('info');
    const prevGauntletSecsRef = useRef<number | null>(null);
    const parasiteSnapRef = useRef<{
        level: number;
        parasiteFloors: number;
        lives: number;
        ward: number;
    } | null>(null);
    const pickupSnapRef = useRef<{
        level: number;
        claimed: number;
        tiles: readonly Tile[];
    } | null>(null);
    const actionSnapRef = useRef<{
        level: number;
        lives: number;
        guardTokens: number;
        comboShards: number;
        shopGold: number;
        matchedPairs: number;
        pairCount: number;
        mismatches: number;
        objectiveProgress: number;
        objectiveRequired: number;
        objectiveLabel: string | null;
        recallFocus: number;
        recallMatches: number;
        recallMistakes: number;
        recallBonusScore: number;
        forgottenTileCount: number;
        dungeonEnemiesDefeated: number;
        enemyHazardHits: number;
        enemyHazardsDefeated: number;
    } | null>(null);
    const chainSnapRef = useRef<{ level: number | null; streak: number } | null>(null);
    const hazardSnapRef = useRef<{
        level: number;
        total: number;
        shuffleSnare: number;
        cascadeCache: number;
        mirrorDecoy: number;
        fragileCacheClaim: number;
        fragileCacheBreak: number;
        tollCache: number;
        fuseCache: number;
        fuseCacheExpired: number;
    } | null>(null);
    const lanternSnapRef = useRef<{ level: number; scouts: number } | null>(null);
    const omenSnapRef = useRef<{ level: number; scouts: number } | null>(null);
    const mimicSnapRef = useRef<{ level: number; claims: number; bites: number; guardBites: number } | null>(null);
    const routeSpecialSnapRef = useRef<{
        level: number;
        anchor: number;
        gateway: number;
        catalyst: number;
        parasite: number;
        pin: number;
    } | null>(null);
    const safeWardSnapRef = useRef<{ level: number; wardsUsed: number } | null>(null);
    const normalizedRecallFocus = normalizeRecallFocusForAnnouncement(recallFocus, recallFocusMax);

    const queueRef = useRef(new Map<string, { text: string; priority: HudAnnouncePriority }>());
    const rafIdRef = useRef<number | null>(null);
    const lastDisplayedAtRef = useRef(0);
    const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingThrottledAnnouncementRef = useRef<{ text: string; priority: HudAnnouncePriority } | null>(null);

    const tryDeliver = useCallback((text: string, priority: HudAnnouncePriority) => {
        const now = nowMs();
        const last = lastDisplayedAtRef.current;
        const elapsed = last === 0 ? POLITE_HUD_THROTTLE_MS : now - last;

        const fire = (): void => {
            setMessagePriority(priority);
            flushThenSet(text, setMessage);
            lastDisplayedAtRef.current = nowMs();
            throttleTimerRef.current = null;
            pendingThrottledAnnouncementRef.current = null;
        };

        if (last === 0 || elapsed >= POLITE_HUD_THROTTLE_MS) {
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
                throttleTimerRef.current = null;
            }
            fire();
            return;
        }

        const pending = pendingThrottledAnnouncementRef.current;
        if (pending && PRIORITY_RANK[pending.priority] > PRIORITY_RANK[priority]) {
            return;
        }
        pendingThrottledAnnouncementRef.current = { text, priority };
        const wait = POLITE_HUD_THROTTLE_MS - elapsed;
        if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
        }
        throttleTimerRef.current = setTimeout(() => {
            const pending = pendingThrottledAnnouncementRef.current;
            if (pending) {
                setMessagePriority(pending.priority);
                flushThenSet(pending.text, setMessage);
                lastDisplayedAtRef.current = nowMs();
            }
            throttleTimerRef.current = null;
            pendingThrottledAnnouncementRef.current = null;
        }, wait);
    }, []);

    const flushAnnouncementQueue = useCallback(() => {
        if (queueRef.current.size === 0) {
            return;
        }
        const entries = [...queueRef.current.entries()].map(([key, v]) => ({ key, ...v }));
        queueRef.current.clear();
        entries.sort((a, b) => {
            const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
            if (pr !== 0) {
                return pr;
            }
            return a.key.localeCompare(b.key);
        });
        const combined = entries.map((e) => e.text).join(' ');
        tryDeliver(combined, entries[0]?.priority ?? 'info');
    }, [tryDeliver]);

    const scheduleQueueFlush = useCallback(() => {
        if (rafIdRef.current != null) {
            return;
        }
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            flushAnnouncementQueue();
        });
    }, [flushAnnouncementQueue]);

    const queuePoliteAnnouncement = useCallback(
        (text: string, opts?: { dedupeKey?: string; priority?: HudAnnouncePriority }) => {
            const dedupeKey = opts?.dedupeKey ?? text;
            const priority = opts?.priority ?? 'info';
            const prev = queueRef.current.get(dedupeKey);
            if (prev && PRIORITY_RANK[prev.priority] > PRIORITY_RANK[priority]) {
                return;
            }
            queueRef.current.set(dedupeKey, { text, priority });
            scheduleQueueFlush();
        },
        [scheduleQueueFlush]
    );

    useEffect(
        () => () => {
            if (rafIdRef.current != null) {
                cancelAnimationFrame(rafIdRef.current);
            }
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
            }
        },
        []
    );

    useEffect(() => {
        if (!gauntletActive || gauntletRemainingMs === null) {
            prevGauntletSecsRef.current = null;
            return;
        }
        const secs = Math.ceil(gauntletRemainingMs / 1000);
        const prev = prevGauntletSecsRef.current;
        prevGauntletSecsRef.current = secs;
        if (prev === null) {
            return;
        }
        for (const bound of GAUNTLET_WARN_SECS) {
            if (prev > bound && secs <= bound) {
                queuePoliteAnnouncement(gauntletMessageForThreshold(secs), {
                    dedupeKey: `gauntlet:${bound}`,
                    priority: 'info'
                });
                return;
            }
        }
    }, [gauntletActive, gauntletRemainingMs, queuePoliteAnnouncement]);

    useEffect(() => {
        if (!scoreParasiteActive || boardLevel === null) {
            parasiteSnapRef.current = null;
            return;
        }

        const snap = parasiteSnapRef.current;
        const nextSnap = {
            level: boardLevel,
            parasiteFloors,
            lives,
            ward: parasiteWardRemaining
        };

        if (snap === null) {
            parasiteSnapRef.current = nextSnap;
            return;
        }

        if (boardLevel < snap.level) {
            parasiteSnapRef.current = nextSnap;
            return;
        }

        const levelAdvanced = boardLevel > snap.level;
        if (levelAdvanced) {
            const crossedDrain = snap.parasiteFloors === 3 && parasiteFloors === 0;
            if (crossedDrain) {
                if (lives < snap.lives) {
                    queuePoliteAnnouncement('Score parasite drained one life.', {
                        dedupeKey: 'parasite:drain',
                        priority: 'info'
                    });
                } else if (parasiteWardRemaining < snap.ward) {
                    queuePoliteAnnouncement('Score parasite drain absorbed by ward.', {
                        dedupeKey: 'parasite:ward',
                        priority: 'info'
                    });
                }
            } else if (parasiteFloors === 3 && snap.parasiteFloors === 2) {
                queuePoliteAnnouncement('Score parasite: next cleared floor triggers the drain unless warded.', {
                    dedupeKey: 'parasite:warn',
                    priority: 'info'
                });
            }
        }

        parasiteSnapRef.current = nextSnap;
    }, [boardLevel, lives, parasiteFloors, parasiteWardRemaining, queuePoliteAnnouncement, scoreParasiteActive]);

    useEffect(() => {
        if (boardLevel === null) {
            pickupSnapRef.current = null;
            return;
        }

        const snap = pickupSnapRef.current;
        const nextSnap = {
            level: boardLevel,
            claimed: findablesClaimedThisFloor,
            tiles: boardTiles
        };

        if (snap === null || boardLevel < snap.level) {
            pickupSnapRef.current = nextSnap;
            return;
        }

        if (boardLevel === snap.level && findablesClaimedThisFloor > snap.claimed) {
            const claimedKind = detectClaimedFindableKind(snap.tiles, boardTiles);
            if (claimedKind != null) {
                queuePoliteAnnouncement(getFindableAnnouncementText(claimedKind), {
                    dedupeKey: `pickup:${claimedKind}`,
                    priority: 'info'
                });
            }
        }

        pickupSnapRef.current = nextSnap;
    }, [boardLevel, boardTiles, findablesClaimedThisFloor, queuePoliteAnnouncement]);

    useEffect(() => {
        if (boardLevel === null) {
            actionSnapRef.current = null;
            return;
        }

        const nextSnap = {
            level: boardLevel,
            lives,
            guardTokens,
            comboShards,
            shopGold,
            matchedPairs,
            pairCount,
            mismatches,
            objectiveProgress,
            objectiveRequired,
            objectiveLabel,
            recallFocus: normalizedRecallFocus,
            recallMatches: recallMatchesThisFloor,
            recallMistakes: recallMistakesThisFloor,
            recallBonusScore: recallBonusScoreThisFloor,
            forgottenTileCount: forgottenTileCountThisFloor,
            dungeonEnemiesDefeated: dungeonEnemiesDefeatedThisFloor,
            enemyHazardHits: enemyHazardHitsThisFloor,
            enemyHazardsDefeated: enemyHazardsDefeatedThisFloor
        };
        const snap = actionSnapRef.current;

        if (snap === null || snap.level !== boardLevel) {
            actionSnapRef.current = nextSnap;
            return;
        }

        const lines: string[] = [];
        const lifeDelta = lives - snap.lives;
        const guardDelta = guardTokens - snap.guardTokens;
        const shardDelta = comboShards - snap.comboShards;
        const goldDelta = shopGold - snap.shopGold;
        const matchDelta = matchedPairs - snap.matchedPairs;
        const mismatchDelta = mismatches - snap.mismatches;
        const objectiveDelta = objectiveProgress - snap.objectiveProgress;
        const recallMatchDelta = recallMatchesThisFloor - snap.recallMatches;
        const recallMistakeDelta = recallMistakesThisFloor - snap.recallMistakes;
        const recallBonusDelta = recallBonusScoreThisFloor - snap.recallBonusScore;
        const forgottenDelta = forgottenTileCountThisFloor - snap.forgottenTileCount;
        const dungeonEnemyDefeatDelta = dungeonEnemiesDefeatedThisFloor - snap.dungeonEnemiesDefeated;
        const enemyHazardHitDelta = enemyHazardHitsThisFloor - snap.enemyHazardHits;
        const enemyHazardDefeatDelta = enemyHazardsDefeatedThisFloor - snap.enemyHazardsDefeated;
        const recallFocusLost = normalizedRecallFocus < snap.recallFocus;

        if (lifeDelta < 0) {
            lines.push(`Life lost. ${lives} ${lives === 1 ? 'life remains' : 'lives remain'}.`);
        } else if (lifeDelta > 0) {
            lines.push(`Life restored. ${lives} ${lives === 1 ? 'life available' : 'lives available'}.`);
        } else if (guardDelta < 0) {
            lines.push(`Guard token spent. ${guardTokens} guard ${guardTokens === 1 ? 'token remains' : 'tokens remain'}.`);
        } else if (guardDelta > 0) {
            lines.push(`${pluralize(guardDelta, 'guard token')} gained. ${guardTokens} available.`);
        }

        if (mismatchDelta > 0 && lifeDelta >= 0 && guardDelta >= 0) {
            lines.push('No match. Cards will turn back.');
        }

        if (enemyHazardHitDelta > 0) {
            lines.push(
                enemyHazardHitDelta === 1
                    ? 'Moving enemy contact.'
                    : `${enemyHazardHitDelta} moving enemy contacts.`
            );
        }

        if (recallMistakeDelta > 0) {
            const forgottenCount = forgottenTileCountThisFloor;
            lines.push(
                forgottenCount > 0
                    ? `Recall broken. ${forgottenCount} ${forgottenCount === 1 ? 'tile memory is' : 'tile memories are'} unstable.`
                    : 'Recall broken. Focus lost.'
            );
        } else if (forgottenDelta > 0 || (recallFocusLost && matchDelta <= 0)) {
            const forgottenCount = Math.max(forgottenDelta, forgottenTileCountThisFloor);
            lines.push(
                forgottenCount > 0
                    ? `Memory aid used. Recall focus ${normalizedRecallFocus}/${recallFocusMax}; ${forgottenCount} ${forgottenCount === 1 ? 'tile memory is' : 'tile memories are'} unstable.`
                    : `Memory aid used. Recall focus ${normalizedRecallFocus}/${recallFocusMax}.`
            );
        }

        if (matchDelta > 0) {
            const pairTotal = Math.max(pairCount, matchedPairs, snap.pairCount);
            lines.push(`Match resolved. ${matchedPairs}/${pairTotal} pairs cleared.`);
            if (recallMatchDelta > 0) {
                lines.push(
                    recallBonusDelta > 0
                        ? `Recall focus ${normalizedRecallFocus}/${recallFocusMax}; +${recallBonusDelta} memory score.`
                        : `Recall focus ${normalizedRecallFocus}/${recallFocusMax}.`
                );
            }
            if (forgottenDelta < 0) {
                const settledCount = Math.abs(forgottenDelta);
                lines.push(
                    `${settledCount} ${settledCount === 1 ? 'unstable tile memory' : 'unstable tile memories'} stabilized.`
                );
            }
            if (enemyHazardDefeatDelta > 0) {
                lines.push(
                    enemyHazardDefeatDelta === 1
                        ? `Moving enemy defeated. ${enemyHazardsDefeatedThisFloor} cleared this floor.`
                        : `${enemyHazardDefeatDelta} moving enemies defeated. ${enemyHazardsDefeatedThisFloor} cleared this floor.`
                );
            }
            if (dungeonEnemyDefeatDelta > 0) {
                lines.push(
                    dungeonEnemyDefeatDelta === 1
                        ? `Dungeon enemy defeated. ${dungeonEnemiesDefeatedThisFloor} defeated this floor.`
                        : `${dungeonEnemyDefeatDelta} dungeon enemies defeated. ${dungeonEnemiesDefeatedThisFloor} defeated this floor.`
                );
            }
        }

        if (
            objectiveRequired > 0 &&
            (objectiveDelta > 0 || (objectiveProgress >= objectiveRequired && snap.objectiveProgress < snap.objectiveRequired))
        ) {
            const label = objectiveLabel ?? 'Objective';
            const complete = objectiveRequired > 0 && objectiveProgress >= objectiveRequired;
            lines.push(
                `${label}: ${Math.min(objectiveProgress, objectiveRequired)}/${objectiveRequired}${
                    complete ? ' complete' : ''
                }.`
            );
        }

        if (shardDelta > 0) {
            lines.push(`${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'gained')}. ${comboShards} available.`);
        } else if (shardDelta < 0) {
            lines.push(`${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'spent')}. ${comboShards} available.`);
        }

        if (goldDelta > 0) {
            lines.push(`${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'gained', 'shop gold')}. ${shopGold} available.`);
        } else if (goldDelta < 0) {
            lines.push(`${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'spent', 'shop gold')}. ${shopGold} available.`);
        }

        if (lines.length > 0) {
            queuePoliteAnnouncement(lines.join(' '), {
                dedupeKey: `action:${boardLevel}:${matchedPairs}:${mismatches}:${lives}:${guardTokens}:${comboShards}:${shopGold}:${objectiveProgress}:${normalizedRecallFocus}:${recallMatchesThisFloor}:${recallMistakesThisFloor}:${forgottenTileCountThisFloor}:${dungeonEnemiesDefeatedThisFloor}:${enemyHazardHitsThisFloor}:${enemyHazardsDefeatedThisFloor}`,
                priority: lifeDelta < 0 || enemyHazardHitDelta > 0 ? 'error' : 'info'
            });
        }

        actionSnapRef.current = nextSnap;
    }, [
        boardLevel,
        comboShards,
        dungeonEnemiesDefeatedThisFloor,
        guardTokens,
        lives,
        matchedPairs,
        mismatches,
        objectiveLabel,
        objectiveProgress,
        objectiveRequired,
        pairCount,
        queuePoliteAnnouncement,
        forgottenTileCountThisFloor,
        enemyHazardHitsThisFloor,
        enemyHazardsDefeatedThisFloor,
        recallBonusScoreThisFloor,
        recallFocusMax,
        normalizedRecallFocus,
        recallMatchesThisFloor,
        recallMistakesThisFloor,
        shopGold
    ]);

    useEffect(() => {
        if (!chainAnnounceActive || boardLevel === null) {
            return;
        }

        const snap = chainSnapRef.current;
        if (snap === null || snap.level !== boardLevel) {
            chainSnapRef.current = { level: boardLevel, streak: chainMatchStreak };
            return;
        }

        const prev = snap.streak;
        if (chainMatchStreak > prev) {
            for (const m of CHAIN_MILESTONE_THRESHOLDS) {
                if (prev < m && chainMatchStreak >= m) {
                    queuePoliteAnnouncement(
                        m === 3
                            ? 'Chain times three - consecutive matches boost your score.'
                            : `Chain times ${m} - keep the chain for bigger match payouts.`,
                        { dedupeKey: `chain:${boardLevel}:${m}`, priority: 'info' }
                    );
                    break;
                }
            }
        }

        chainSnapRef.current = { level: boardLevel, streak: chainMatchStreak };
    }, [boardLevel, chainAnnounceActive, chainMatchStreak, queuePoliteAnnouncement]);

    useEffect(() => {
        if (boardLevel === null) {
            hazardSnapRef.current = null;
            return;
        }

        const nextSnap = {
            level: boardLevel,
            total: hazardTileTriggersThisFloor,
            shuffleSnare: hazardShuffleSnaresThisFloor,
            cascadeCache: hazardCascadeCachesThisFloor,
            mirrorDecoy: hazardMirrorDecoysThisFloor,
            fragileCacheClaim: hazardFragileCacheClaimsThisFloor,
            fragileCacheBreak: hazardFragileCacheBreaksThisFloor,
            tollCache: hazardTollCachesThisFloor,
            fuseCache: hazardFuseCachesThisFloor,
            fuseCacheExpired: hazardFuseCacheExpiredClaimsThisFloor
        };
        const snap = hazardSnapRef.current;

        if (snap === null || snap.level !== boardLevel || hazardTileTriggersThisFloor < snap.total) {
            hazardSnapRef.current = nextSnap;
            return;
        }

        const firedKinds = HAZARD_ANNOUNCEMENT_ORDER.filter((kind) => {
            if (kind === 'shuffle_snare') return hazardShuffleSnaresThisFloor > snap.shuffleSnare;
            if (kind === 'cascade_cache') return hazardCascadeCachesThisFloor > snap.cascadeCache;
            if (kind === 'mirror_decoy') return hazardMirrorDecoysThisFloor > snap.mirrorDecoy;
            if (kind === 'fragile_cache') {
                return hazardFragileCacheClaimsThisFloor > snap.fragileCacheClaim || hazardFragileCacheBreaksThisFloor > snap.fragileCacheBreak;
            }
            if (kind === 'toll_cache') return hazardTollCachesThisFloor > snap.tollCache;
            return hazardFuseCachesThisFloor > snap.fuseCache;
        });

        if (firedKinds.length > 0) {
            const copy = firedKinds.flatMap((kind) => {
                const liveCopy = getHazardTileLiveCopy(kind);
                if (kind !== 'fragile_cache') {
                    if (kind === 'fuse_cache' && hazardFuseCacheExpiredClaimsThisFloor > snap.fuseCacheExpired) {
                        return [
                            reduceMotion
                                ? liveCopy.reducedMotionBreakLiveAnnouncement ?? liveCopy.reducedMotionLiveAnnouncement
                                : liveCopy.breakLiveAnnouncement ?? liveCopy.liveAnnouncement
                        ];
                    }
                    return [reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement];
                }
                const parts: string[] = [];
                if (hazardFragileCacheClaimsThisFloor > snap.fragileCacheClaim) {
                    parts.push(reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement);
                }
                if (hazardFragileCacheBreaksThisFloor > snap.fragileCacheBreak) {
                    parts.push(
                        reduceMotion
                            ? liveCopy.reducedMotionBreakLiveAnnouncement ?? liveCopy.reducedMotionLiveAnnouncement
                            : liveCopy.breakLiveAnnouncement ?? liveCopy.liveAnnouncement
                    );
                }
                return parts;
            }).join(' ');
            queuePoliteAnnouncement(copy, {
                dedupeKey: `hazard:${boardLevel}:${hazardTileTriggersThisFloor}`,
                priority: 'info'
            });
        }

        hazardSnapRef.current = nextSnap;
    }, [
        boardLevel,
        hazardCascadeCachesThisFloor,
        hazardFragileCacheBreaksThisFloor,
        hazardFragileCacheClaimsThisFloor,
        hazardFuseCacheExpiredClaimsThisFloor,
        hazardFuseCachesThisFloor,
        hazardMirrorDecoysThisFloor,
        hazardShuffleSnaresThisFloor,
        hazardTileTriggersThisFloor,
        hazardTollCachesThisFloor,
        queuePoliteAnnouncement,
        reduceMotion
    ]);

    useEffect(() => {
        if (boardLevel === null) {
            lanternSnapRef.current = null;
            return;
        }

        const snap = lanternSnapRef.current;
        const nextSnap = { level: boardLevel, scouts: lanternWardScoutsThisFloor };
        if (snap === null || snap.level !== boardLevel || lanternWardScoutsThisFloor < snap.scouts) {
            lanternSnapRef.current = nextSnap;
            return;
        }

        if (lanternWardScoutsThisFloor > snap.scouts) {
            queuePoliteAnnouncement('Lantern Ward scouted a hidden threat.', {
                dedupeKey: `lantern:${boardLevel}:${lanternWardScoutsThisFloor}`,
                priority: 'info'
            });
        }

        lanternSnapRef.current = nextSnap;
    }, [boardLevel, lanternWardScoutsThisFloor, queuePoliteAnnouncement]);

    useEffect(() => {
        if (boardLevel === null) {
            omenSnapRef.current = null;
            return;
        }

        const snap = omenSnapRef.current;
        const nextSnap = { level: boardLevel, scouts: omenSealScoutsThisFloor };
        if (snap === null || snap.level !== boardLevel || omenSealScoutsThisFloor < snap.scouts) {
            omenSnapRef.current = nextSnap;
            return;
        }

        if (omenSealScoutsThisFloor > snap.scouts) {
            queuePoliteAnnouncement('Omen Seal revealed hidden danger.', {
                dedupeKey: `omen:${boardLevel}:${omenSealScoutsThisFloor}`,
                priority: 'info'
            });
        }

        omenSnapRef.current = nextSnap;
    }, [boardLevel, omenSealScoutsThisFloor, queuePoliteAnnouncement]);

    useEffect(() => {
        if (boardLevel === null) {
            mimicSnapRef.current = null;
            return;
        }

        const snap = mimicSnapRef.current;
        const nextSnap = {
            level: boardLevel,
            claims: mimicCacheClaimsThisFloor,
            bites: mimicCacheBitesThisFloor,
            guardBites: mimicCacheGuardBitesThisFloor
        };
        if (
            snap === null ||
            snap.level !== boardLevel ||
            mimicCacheClaimsThisFloor < snap.claims ||
            mimicCacheBitesThisFloor < snap.bites ||
            mimicCacheGuardBitesThisFloor < snap.guardBites
        ) {
            mimicSnapRef.current = nextSnap;
            return;
        }

        if (mimicCacheBitesThisFloor > snap.bites) {
            const guardBlocked = mimicCacheGuardBitesThisFloor > snap.guardBites;
            queuePoliteAnnouncement(
                guardBlocked
                    ? 'Mimic Cache bit. Guard absorbed the hit.'
                    : 'Mimic Cache bit. Life lost; reduced loot claimed.',
                {
                    dedupeKey: `mimic:bite:${boardLevel}:${mimicCacheBitesThisFloor}`,
                    priority: 'error'
                }
            );
        } else if (mimicCacheClaimsThisFloor > snap.claims) {
            queuePoliteAnnouncement('Mimic Cache controlled. Full loot claimed.', {
                dedupeKey: `mimic:claim:${boardLevel}:${mimicCacheClaimsThisFloor}`,
                priority: 'info'
            });
        }

        mimicSnapRef.current = nextSnap;
    }, [
        boardLevel,
        mimicCacheBitesThisFloor,
        mimicCacheClaimsThisFloor,
        mimicCacheGuardBitesThisFloor,
        queuePoliteAnnouncement
    ]);

    useEffect(() => {
        if (boardLevel === null) {
            routeSpecialSnapRef.current = null;
            return;
        }
        const snap = routeSpecialSnapRef.current;
        const nextSnap = {
            level: boardLevel,
            anchor: anchorSealUsesThisFloor,
            gateway: loadedGatewayPlansThisFloor,
            catalyst: catalystAltarUpgradesThisFloor,
            parasite: parasiteVesselConversionsThisFloor,
            pin: pinLatticeRewardsThisFloor
        };
        if (
            snap === null ||
            snap.level !== boardLevel ||
            anchorSealUsesThisFloor < snap.anchor ||
            loadedGatewayPlansThisFloor < snap.gateway ||
            catalystAltarUpgradesThisFloor < snap.catalyst ||
            parasiteVesselConversionsThisFloor < snap.parasite ||
            pinLatticeRewardsThisFloor < snap.pin
        ) {
            routeSpecialSnapRef.current = nextSnap;
            return;
        }
        const announcements: [boolean, string, string][] = [
            [anchorSealUsesThisFloor > snap.anchor, 'anchor', 'Anchor Seal froze rotating pressure.'],
            [loadedGatewayPlansThisFloor > snap.gateway, 'gateway', 'Loaded Gateway prepared the next route.'],
            [catalystAltarUpgradesThisFloor > snap.catalyst, 'catalyst', 'Catalyst Altar converted a shard into reward.'],
            [parasiteVesselConversionsThisFloor > snap.parasite, 'parasite', 'Parasite Vessel reduced pressure.'],
            [pinLatticeRewardsThisFloor > snap.pin, 'pin', 'Pin Lattice rewarded deliberate planning.']
        ];
        const nextAnnouncement = announcements.find(([changed]) => changed);
        if (nextAnnouncement) {
            queuePoliteAnnouncement(nextAnnouncement[2], {
                dedupeKey: `route-special:${nextAnnouncement[1]}:${boardLevel}`,
                priority: 'info'
            });
        }
        routeSpecialSnapRef.current = nextSnap;
    }, [
        anchorSealUsesThisFloor,
        boardLevel,
        catalystAltarUpgradesThisFloor,
        loadedGatewayPlansThisFloor,
        parasiteVesselConversionsThisFloor,
        pinLatticeRewardsThisFloor,
        queuePoliteAnnouncement
    ]);

    useEffect(() => {
        if (boardLevel === null) {
            safeWardSnapRef.current = null;
            return;
        }

        const snap = safeWardSnapRef.current;
        const nextSnap = { level: boardLevel, wardsUsed: safeHazardWardsUsedThisFloor };
        if (snap === null || snap.level !== boardLevel || safeHazardWardsUsedThisFloor < snap.wardsUsed) {
            safeWardSnapRef.current = nextSnap;
            return;
        }

        if (safeHazardWardsUsedThisFloor > snap.wardsUsed) {
            queuePoliteAnnouncement('Guard Cache ward blocked a hazard.', {
                dedupeKey: `safeWard:${boardLevel}:${safeHazardWardsUsedThisFloor}`,
                priority: 'info'
            });
        }

        safeWardSnapRef.current = nextSnap;
    }, [boardLevel, queuePoliteAnnouncement, safeHazardWardsUsedThisFloor]);

    useEffect(() => {
        if (
            !gambitThirdPickActive ||
            boardLevel === null ||
            !gambitOpportunityFlippedIds ||
            gambitOpportunityFlippedIds.length !== 2
        ) {
            return;
        }
        const pairKey = [...gambitOpportunityFlippedIds].sort().join(',');
        queuePoliteAnnouncement(GAMBIT_OPPORTUNITY_HINT_LINE, {
            dedupeKey: `gambit:${boardLevel}:${pairKey}`,
            priority: 'info'
        });
    }, [
        boardLevel,
        gambitOpportunityFlippedIds,
        gambitThirdPickActive,
        queuePoliteAnnouncement
    ]);

    return { message, priority: messagePriority, queuePoliteAnnouncement };
};
