import { useCallback, useEffect, useRef, useState } from 'react';
import { runNonNegativeInteger, runNonNegativeIntegerWithFallback } from '../../shared/run-number-guards';
import { buildBoardTurnAnnouncement, volatileShuffleAnnouncementLine } from '../copy/boardTurnAnnouncement';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import type { GameplayFeedbackPresentation } from '../store/gameplayFeedbackAdapter';
import {
    GAUNTLET_WARN_SECS,
    tileTraitKindLabels,
    gauntletMessageForThreshold,
    joinReadableList,
    pluralize,
    resourceDeltaCopy
} from '../copy/hudActionFeedback';

export { formatHudActionFeedbackText, getFindableToastText } from '../copy/hudActionFeedback';

/** Min interval between polite live-region updates (anti-spam for screen readers). */
const POLITE_HUD_THROTTLE_MS = 400;

type HudAnnouncePriority = 'info' | 'error';

const PRIORITY_RANK: Record<HudAnnouncePriority, number> = { error: 2, info: 1 };

const payoffIntensityAnnouncementLine = ({
    chainMatchStreak,
    comboShardDelta,
    guardTokenDelta,
    lifeDelta,
    shopGoldDelta,
    traitMatchCount
}: {
    chainMatchStreak: number;
    comboShardDelta: number;
    guardTokenDelta: number;
    lifeDelta: number;
    shopGoldDelta: number;
    traitMatchCount: number;
}): string | null => {
    const lanes = [
        comboShardDelta > 0 ? 'combo shard' : null,
        guardTokenDelta > 0 ? 'guard token' : null,
        lifeDelta > 0 ? 'life' : null,
        shopGoldDelta > 0 ? 'shop gold' : null,
        traitMatchCount >= 2 ? 'trait surge' : null
    ].filter((lane): lane is string => lane !== null);
    if (lanes.length < 2) {
        return null;
    }
    if (lanes.length >= 4) {
        return `Payoff stack: ${lanes.length} payoffs cashed. Cash stack now.`;
    }
    if (chainMatchStreak >= 3) {
        return `Cashout hit: ${lanes.length} payoffs paid together. Keep the chain live.`;
    }
    return `Reward cashout: ${lanes.length} payoffs paid together.`;
};

interface HudPoliteLiveAnnouncementInput {
    gameplayFeedback?: GameplayFeedbackPresentation | null;
    gauntletRemainingMs: number | null;
    gauntletActive: boolean;
    scoreParasiteActive: boolean;
    parasiteFloors: number;
    parasiteWardRemaining: number;
    lives: number;
    guardTokens: number;
    comboShards: number;
    shopGold: number;
    shuffleCharges?: number;
    regionShuffleCharges?: number;
    stickyBlockIndex?: number | null;
    boardLevel: number | null;
    /** Latest resolved turn, the source of truth for pickup announcements. */
    boardTurnEvent?: BoardTurnResolvedEvent | null;
    objectiveProgress?: number;
    objectiveRequired?: number;
    objectiveLabel?: string | null;
    recallFocus?: number;
    recallFocusMax?: number;
    recallMatchesThisFloor?: number;
    recallMistakesThisFloor?: number;
    recallBonusScoreThisFloor?: number;
    forgottenTileCountThisFloor?: number;
    /** When false, chain milestone announcements are suppressed (e.g. memorize or menus). */
    /** Gambit third-flip window (two tiles face-up, mismatch resolving). */
    gambitThirdPickActive: boolean;
    /** Flipped tile ids when Gambit is offered (length 2); used for dedupe keys. */
    gambitOpportunityFlippedIds: readonly string[] | null;
    /** Motion setting for hazard effect announcement copy. */
    reduceMotion?: boolean;
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

const normalizeRecallFocusForAnnouncement = (focus: number, max: number): { focus: number; max: number } => {
    const boundedMax = runNonNegativeIntegerWithFallback(max, 3);
    return {
        focus: Math.min(boundedMax, runNonNegativeInteger(focus)),
        max: boundedMax
    };
};

/**
 * HUD-015: polite `aria-live` source text for gauntlet deadline buckets and score-parasite milestones.
 * Batches concurrent announcements on `requestAnimationFrame`, dedupes by key, prefers higher priority,
 * and throttles display cadence so screen readers get summaries, not chatter.
 */

export const useHudPoliteLiveAnnouncement = ({
    boardTurnEvent = null,
    gameplayFeedback = null,
    gauntletRemainingMs,
    gauntletActive,
    scoreParasiteActive,
    parasiteFloors,
    parasiteWardRemaining,
    lives,
    guardTokens,
    comboShards,
    shopGold,
    shuffleCharges = 0,
    regionShuffleCharges = 0,
    stickyBlockIndex = null,
    boardLevel,
    objectiveProgress = 0,
    objectiveRequired = 0,
    objectiveLabel = null,
    recallFocus = 0,
    recallFocusMax = 3,
    recallMatchesThisFloor = 0,
    recallMistakesThisFloor = 0,
    recallBonusScoreThisFloor = 0,
    forgottenTileCountThisFloor = 0,
    gambitThirdPickActive,
    gambitOpportunityFlippedIds,
    reduceMotion = false,
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
    const actionSnapRef = useRef<{
        level: number;
        lives: number;
        guardTokens: number;
        comboShards: number;
        shopGold: number;
        shuffleCharges: number;
        regionShuffleCharges: number;
        stickyBlockIndex: number | null;
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
    const announcedGameplayFeedbackEventIdRef = useRef<string | null>(null);
    // Read inside the effects rather than during render: whether a feedback event has
    // already been spoken is not a rendering concern, and a render-time read of the ref
    // returns whatever the last committed effect left there.
    const unannouncedGameplayFeedback = useCallback(
        (): GameplayFeedbackPresentation | null =>
            gameplayFeedback && gameplayFeedback.eventId !== announcedGameplayFeedbackEventIdRef.current
                ? gameplayFeedback
                : null,
        [gameplayFeedback]
    );
    const { focus: normalizedRecallFocusValue, max: normalizedRecallFocusMax } = normalizeRecallFocusForAnnouncement(
        recallFocus,
        recallFocusMax
    );

    const queueRef = useRef(new Map<string, { text: string; priority: HudAnnouncePriority }>());
    const rafIdRef = useRef<number | null>(null);
    const lastDisplayedAtRef = useRef<number | null>(null);
    const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingThrottledAnnouncementRef = useRef<{ text: string; priority: HudAnnouncePriority } | null>(null);
    const livePublishTokenRef = useRef(0);

    const flushThenSetMessage = useCallback((text: string): void => {
        const token = livePublishTokenRef.current + 1;
        livePublishTokenRef.current = token;
        setMessage('');
        queueMicrotask(() => {
            if (livePublishTokenRef.current === token) {
                setMessage(text);
            }
        });
    }, []);

    const tryDeliver = useCallback((text: string, priority: HudAnnouncePriority) => {
        const now = nowMs();
        const last = lastDisplayedAtRef.current;
        const elapsed = last === null ? POLITE_HUD_THROTTLE_MS : now - last;

        const fire = (): void => {
            setMessagePriority(priority);
            flushThenSetMessage(text);
            lastDisplayedAtRef.current = nowMs();
            throttleTimerRef.current = null;
            pendingThrottledAnnouncementRef.current = null;
        };

        if (last === null || elapsed >= POLITE_HUD_THROTTLE_MS) {
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
                flushThenSetMessage(pending.text);
                lastDisplayedAtRef.current = nowMs();
            }
            throttleTimerRef.current = null;
            pendingThrottledAnnouncementRef.current = null;
        }, wait);
    }, [flushThenSetMessage]);

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
            livePublishTokenRef.current += 1;
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

    // Pickups are announced from the resolved-turn event rather than by diffing the
    // previous board's tiles against the current ones. The core already reports which
    // findable was claimed, and the event id makes the dedupe key unique per turn, so a
    // re-render cannot re-announce and two identical pickups on different turns both are.
    useEffect(() => {
        if (!boardTurnEvent || unannouncedGameplayFeedback()?.source.kind === 'findable') {
            return;
        }
        const announcement = buildBoardTurnAnnouncement(boardTurnEvent, { reduceMotion });
        if (!announcement) {
            return;
        }
        queuePoliteAnnouncement(announcement.lines.join(' '), {
            dedupeKey: announcement.dedupeKey,
            priority: announcement.priority
        });
    }, [boardTurnEvent, queuePoliteAnnouncement, reduceMotion, unannouncedGameplayFeedback]);

    useEffect(() => {
        const newGameplayFeedback = unannouncedGameplayFeedback();
        if (boardLevel === null) {
            actionSnapRef.current = null;
            if (newGameplayFeedback) {
                queuePoliteAnnouncement(newGameplayFeedback.message, {
                    dedupeKey: `gameplay-event:${newGameplayFeedback.eventId}`,
                    priority: newGameplayFeedback.priority
                });
                announcedGameplayFeedbackEventIdRef.current = newGameplayFeedback.eventId;
            }
            return;
        }

        const nextSnap = {
            level: boardLevel,
            lives,
            guardTokens,
            comboShards,
            shopGold,
            shuffleCharges,
            regionShuffleCharges,
            stickyBlockIndex,
            objectiveProgress,
            objectiveRequired,
            objectiveLabel,
            recallFocus: normalizedRecallFocusValue,
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
            if (newGameplayFeedback) {
                queuePoliteAnnouncement(newGameplayFeedback.message, {
                    dedupeKey: `gameplay-event:${newGameplayFeedback.eventId}`,
                    priority: newGameplayFeedback.priority
                });
                announcedGameplayFeedbackEventIdRef.current = newGameplayFeedback.eventId;
            }
            return;
        }

        const lines: string[] = newGameplayFeedback ? [newGameplayFeedback.message] : [];
        const lifeDelta = lives - snap.lives;
        const guardDelta = guardTokens - snap.guardTokens;
        const shardDelta = comboShards - snap.comboShards;
        const goldDelta = shopGold - snap.shopGold;
        const shuffleChargeDelta = shuffleCharges - snap.shuffleCharges;
        const regionShuffleChargeDelta = regionShuffleCharges - snap.regionShuffleCharges;
        const stasisLocked = stickyBlockIndex !== null && snap.stickyBlockIndex !== stickyBlockIndex;
        // Turn outcomes come from the resolved-turn event, not from diffing this render
        // against the previous one. The core already decided what the turn did; inferring
        // it here could disagree, and did whenever a render was skipped or coalesced.
        const turnFacts = boardTurnEvent?.announcement ?? null;
        const matchDelta = turnFacts ? turnFacts.matchedPairsAfter - turnFacts.matchedPairsBefore : 0;
        const mismatchDelta = turnFacts ? turnFacts.mismatchesAfter - turnFacts.mismatchesBefore : 0;
        const traitLabels = tileTraitKindLabels(turnFacts?.matchedTraitKinds ?? []);
        const traitMatchLabels = matchDelta > 0 ? traitLabels : [];
        const traitMismatchLabels = mismatchDelta > 0 ? traitLabels : [];
        const objectiveDelta = objectiveProgress - snap.objectiveProgress;
        const recallMatchDelta = recallMatchesThisFloor - snap.recallMatches;
        const recallMistakeDelta = recallMistakesThisFloor - snap.recallMistakes;
        const recallBonusDelta = recallBonusScoreThisFloor - snap.recallBonusScore;
        const forgottenDelta = forgottenTileCountThisFloor - snap.forgottenTileCount;
        const dungeonEnemyDefeatDelta = dungeonEnemiesDefeatedThisFloor - snap.dungeonEnemiesDefeated;
        const enemyHazardHitDelta = enemyHazardHitsThisFloor - snap.enemyHazardHits;
        const enemyHazardDefeatDelta = enemyHazardsDefeatedThisFloor - snap.enemyHazardsDefeated;
        const recallFocusLost = normalizedRecallFocusValue < snap.recallFocus;

        if (lifeDelta < 0) {
            lines.push(`Life lost. ${lives} ${lives === 1 ? 'life remains' : 'lives remain'}.`);
        } else if (lifeDelta > 0) {
            lines.push(`Life restored. ${lives} ${lives === 1 ? 'life available' : 'lives available'}.`);
        } else if (guardDelta < 0) {
            lines.push(`Guard token spent. ${guardTokens} guard ${guardTokens === 1 ? 'token remains' : 'tokens remain'}.`);
        } else if (guardDelta > 0 && !newGameplayFeedback) {
            lines.push(`${pluralize(guardDelta, 'guard token')} gained. ${guardTokens} available.`);
        }

        if (mismatchDelta > 0 && lifeDelta >= 0 && guardDelta >= 0) {
            lines.push('No match. Recover with a safe match. Chain reset.');
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
                    ? `Memory aid used. Recall focus ${normalizedRecallFocusValue}/${normalizedRecallFocusMax}; ${forgottenCount} ${forgottenCount === 1 ? 'tile memory is' : 'tile memories are'} unstable.`
                    : `Memory aid used. Recall focus ${normalizedRecallFocusValue}/${normalizedRecallFocusMax}.`
            );
        }

        if (matchDelta > 0) {
            const pairTotal = Math.max(turnFacts?.pairTotal ?? 0, turnFacts?.matchedPairsAfter ?? 0);
            lines.push(`Match resolved. ${turnFacts?.matchedPairsAfter ?? 0}/${pairTotal} pairs cleared.`);
            if (traitMatchLabels.length > 0) {
                lines.push(
                    traitMatchLabels.length >= 2
                        ? `Trait combo surge: ${joinReadableList(traitMatchLabels)} resolved.`
                        : `${joinReadableList(traitMatchLabels)} trait resolved.`
                );
            }
            if (regionShuffleChargeDelta > 0) {
                lines.push(`${pluralize(regionShuffleChargeDelta, 'row/swap charge')} gained.`);
            }
            if (shuffleChargeDelta > 0) {
                lines.push(`${pluralize(shuffleChargeDelta, 'full shuffle charge')} gained.`);
            }
            if (stasisLocked) {
                lines.push('Stasis blocked a nearby trait tile from opening first next turn.');
            }
            if (recallMatchDelta > 0) {
                lines.push(
                    recallBonusDelta > 0
                        ? `Recall focus ${normalizedRecallFocusValue}/${normalizedRecallFocusMax}; +${recallBonusDelta} memory score.`
                        : `Recall focus ${normalizedRecallFocusValue}/${normalizedRecallFocusMax}.`
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

        if (traitMismatchLabels.length > 0) {
            lines.push(
                traitMismatchLabels.length >= 2
                    ? `Trait surge: ${traitMismatchLabels.length} penalties applied: ${joinReadableList(traitMismatchLabels)}.`
                    : `${joinReadableList(traitMismatchLabels)} trait penalty applied.`
            );
        }

        const volatileShuffleLine = boardTurnEvent ? volatileShuffleAnnouncementLine(boardTurnEvent) : null;
        if (volatileShuffleLine) {
            lines.push(volatileShuffleLine);
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

        if (shardDelta > 0 && !newGameplayFeedback) {
            lines.push(`${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'gained')}. ${comboShards} available.`);
        } else if (shardDelta < 0) {
            lines.push(`${resourceDeltaCopy(shardDelta, 'Combo shard', 'combo shard', 'spent')}. ${comboShards} available.`);
        }

        if (goldDelta > 0) {
            lines.push(`${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'gained', 'shop gold')}. ${shopGold} available.`);
        } else if (goldDelta < 0) {
            lines.push(`${resourceDeltaCopy(goldDelta, 'Shop gold', 'shop gold', 'spent', 'shop gold')}. ${shopGold} available.`);
        }

        if (matchDelta > 0) {
            const payoffIntensityLine = payoffIntensityAnnouncementLine({
                chainMatchStreak: turnFacts?.currentStreakAfter ?? 0,
                comboShardDelta: shardDelta,
                guardTokenDelta: guardDelta,
                lifeDelta,
                shopGoldDelta: goldDelta,
                traitMatchCount: traitMatchLabels.length
            });
            if (payoffIntensityLine) {
                lines.push(payoffIntensityLine);
            }
        }

        if (lines.length > 0) {
            queuePoliteAnnouncement(lines.join(' '), {
                dedupeKey: `action:${boardLevel}:${lives}:${guardTokens}:${comboShards}:${shopGold}:${shuffleCharges}:${regionShuffleCharges}:${stickyBlockIndex ?? 'none'}:${objectiveProgress}:${normalizedRecallFocusValue}:${normalizedRecallFocusMax}:${recallMatchesThisFloor}:${recallMistakesThisFloor}:${forgottenTileCountThisFloor}:${dungeonEnemiesDefeatedThisFloor}:${enemyHazardHitsThisFloor}:${enemyHazardsDefeatedThisFloor}:${boardTurnEvent?.eventId ?? 'no-turn'}:${newGameplayFeedback?.eventId ?? 'legacy'}`,
                priority:
                    lifeDelta < 0 || enemyHazardHitDelta > 0 || newGameplayFeedback?.priority === 'error'
                        ? 'error'
                        : 'info'
            });
        }

        actionSnapRef.current = nextSnap;
        if (newGameplayFeedback) {
            announcedGameplayFeedbackEventIdRef.current = newGameplayFeedback.eventId;
        }
    }, [
        boardLevel,
        comboShards,
        dungeonEnemiesDefeatedThisFloor,
        guardTokens,
        lives,
        unannouncedGameplayFeedback,
        objectiveLabel,
        objectiveProgress,
        objectiveRequired,
        queuePoliteAnnouncement,
        regionShuffleCharges,
        forgottenTileCountThisFloor,
        enemyHazardHitsThisFloor,
        enemyHazardsDefeatedThisFloor,
        recallBonusScoreThisFloor,
        normalizedRecallFocusMax,
        normalizedRecallFocusValue,
        recallMatchesThisFloor,
        recallMistakesThisFloor,
        shuffleCharges,
        shopGold,
        stickyBlockIndex,
        boardTurnEvent
    ]);








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
