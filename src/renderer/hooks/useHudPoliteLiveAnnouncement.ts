import { useCallback, useEffect, useRef, useState } from 'react';
import { runNonNegativeInteger, runNonNegativeIntegerWithFallback } from '../../shared/run-number-guards';
import { buildBoardTurnAnnouncement } from '../copy/boardTurnAnnouncement';
import { buildGameplayEventBatchAnnouncement } from '../copy/gameplayEventAnnouncement';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import type { GameplayFeedbackPresentation } from '../store/gameplayFeedbackAdapter';
import {
    tileTraitKindLabels,
    joinReadableList,
    pluralize
} from '../copy/hudActionFeedback';

export { formatHudActionFeedbackText, getFindableToastText } from '../copy/hudActionFeedback';

/** Min interval between polite live-region updates (anti-spam for screen readers). */
const POLITE_HUD_THROTTLE_MS = 400;

/** Stable empty default: a fresh array each render would re-run every memo that reads it. */
const EMPTY_FEEDBACK: readonly GameplayFeedbackPresentation[] = [];

type HudAnnouncePriority = 'info' | 'error';

const PRIORITY_RANK: Record<HudAnnouncePriority, number> = { error: 2, info: 1 };

interface HudPoliteLiveAnnouncementInput {
    /**
     * Every feedback event the journal has produced, in order. A list rather than the latest one:
     * a single command can raise several — a match that also claims a findable and trips a hazard
     * — and announcing only the last of them dropped the rest on the floor.
     */
    gameplayFeedback?: readonly GameplayFeedbackPresentation[];
    shuffleCharges?: number;
    regionShuffleCharges?: number;
    stickyBlockIndex?: number | null;
    boardLevel: number | null;
    /** Latest resolved turn, the source of truth for pickup announcements. */
    boardTurnEvent?: BoardTurnResolvedEvent | null;
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
 * HUD-015: polite `aria-live` source text for resolved turns and resource changes.
 * Batches concurrent announcements on `requestAnimationFrame`, dedupes by key, prefers higher priority,
 * and throttles display cadence so screen readers get summaries, not chatter.
 */

export const useHudPoliteLiveAnnouncement = ({
    boardTurnEvent = null,
    gameplayFeedback = EMPTY_FEEDBACK,
    shuffleCharges = 0,
    regionShuffleCharges = 0,
    stickyBlockIndex = null,
    boardLevel,
    recallFocus = 0,
    recallFocusMax = 3,
    recallMatchesThisFloor = 0,
    recallMistakesThisFloor = 0,
    recallBonusScoreThisFloor = 0,
    forgottenTileCountThisFloor = 0,
    gambitThirdPickActive,
    gambitOpportunityFlippedIds,
    reduceMotion = false
}: HudPoliteLiveAnnouncementInput): UseHudPoliteLiveAnnouncementResult => {
    const [message, setMessage] = useState('');
    const [messagePriority, setMessagePriority] = useState<HudAnnouncePriority>('info');
    const actionSnapRef = useRef<{
        level: number;
        shuffleCharges: number;
        regionShuffleCharges: number;
        stickyBlockIndex: number | null;
        recallFocus: number;
        recallMatches: number;
        recallMistakes: number;
        recallBonusScore: number;
        forgottenTileCount: number;
    } | null>(null);
    const announcedGameplayFeedbackEventIdsRef = useRef<Set<string>>(new Set());
    // Read inside the effects rather than during render: whether a feedback event has
    // already been spoken is not a rendering concern, and a render-time read of the ref
    // returns whatever the last committed effect left there.
    const unannouncedGameplayFeedback = useCallback(
        (): readonly GameplayFeedbackPresentation[] =>
            gameplayFeedback.filter((item) => !announcedGameplayFeedbackEventIdsRef.current.has(item.eventId)),
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

    /** One ordered line per command, and every event in it marked spoken. */
    const announceGameplayFeedbackBatch = useCallback(
        (pending: readonly GameplayFeedbackPresentation[]): void => {
            const batch = buildGameplayEventBatchAnnouncement(pending);
            if (!batch) {
                return;
            }
            queuePoliteAnnouncement(batch.message, { dedupeKey: batch.dedupeKey, priority: batch.priority });
            for (const eventId of batch.consumedEventIds) {
                announcedGameplayFeedbackEventIdsRef.current.add(eventId);
            }
        },
        [queuePoliteAnnouncement]
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

    // Pickups are announced from the resolved-turn event rather than by diffing the
    // previous board's tiles against the current ones. The core already reports which
    // findable was claimed, and the event id makes the dedupe key unique per turn, so a
    // re-render cannot re-announce and two identical pickups on different turns both are.
    useEffect(() => {
        if (!boardTurnEvent || unannouncedGameplayFeedback().some((item) => item.source.kind === 'findable')) {
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
            announceGameplayFeedbackBatch(newGameplayFeedback);
            return;
        }

        const nextSnap = {
            level: boardLevel,
            shuffleCharges,
            regionShuffleCharges,
            stickyBlockIndex,
            recallFocus: normalizedRecallFocusValue,
            recallMatches: recallMatchesThisFloor,
            recallMistakes: recallMistakesThisFloor,
            recallBonusScore: recallBonusScoreThisFloor,
            forgottenTileCount: forgottenTileCountThisFloor
        };
        const snap = actionSnapRef.current;

        if (snap === null || snap.level !== boardLevel) {
            actionSnapRef.current = nextSnap;
            announceGameplayFeedbackBatch(newGameplayFeedback);
            return;
        }

        const lines: string[] = newGameplayFeedback.map((item) => item.message);
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
        const recallMatchDelta = recallMatchesThisFloor - snap.recallMatches;
        const recallMistakeDelta = recallMistakesThisFloor - snap.recallMistakes;
        const recallBonusDelta = recallBonusScoreThisFloor - snap.recallBonusScore;
        const forgottenDelta = forgottenTileCountThisFloor - snap.forgottenTileCount;
        const recallFocusLost = normalizedRecallFocusValue < snap.recallFocus;

        // A miss is quiet (thesis §67): the cards reset, the chain does, and that is all it says.
        if (mismatchDelta > 0) {
            lines.push('No match. Recover with a safe match. Chain reset.');
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
        }

        if (traitMismatchLabels.length > 0) {
            lines.push(
                traitMismatchLabels.length >= 2
                    ? `Trait surge: ${traitMismatchLabels.length} penalties applied: ${joinReadableList(traitMismatchLabels)}.`
                    : `${joinReadableList(traitMismatchLabels)} trait penalty applied.`
            );
        }

        if (lines.length > 0) {
            queuePoliteAnnouncement(lines.join(' '), {
                dedupeKey: `action:${boardLevel}:${shuffleCharges}:${regionShuffleCharges}:${stickyBlockIndex ?? 'none'}:${normalizedRecallFocusValue}:${normalizedRecallFocusMax}:${recallMatchesThisFloor}:${recallMistakesThisFloor}:${forgottenTileCountThisFloor}:${boardTurnEvent?.eventId ?? 'no-turn'}:${newGameplayFeedback.map((item) => item.eventId).join(',') || 'legacy'}`,
                priority: newGameplayFeedback.some((item) => item.priority === 'error') ? 'error' : 'info'
            });
        }

        actionSnapRef.current = nextSnap;
        for (const item of newGameplayFeedback) {
            announcedGameplayFeedbackEventIdsRef.current.add(item.eventId);
        }
    }, [
        announceGameplayFeedbackBatch,
        boardLevel,
        unannouncedGameplayFeedback,
        queuePoliteAnnouncement,
        regionShuffleCharges,
        forgottenTileCountThisFloor,
        recallBonusScoreThisFloor,
        normalizedRecallFocusMax,
        normalizedRecallFocusValue,
        recallMatchesThisFloor,
        recallMistakesThisFloor,
        shuffleCharges,
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
