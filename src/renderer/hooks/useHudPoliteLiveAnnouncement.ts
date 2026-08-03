import { useCallback, useEffect, useRef, useState } from 'react';
import { buildBoardTurnAnnouncement } from '../copy/boardTurnAnnouncement';
import { buildGameplayEventBatchAnnouncement } from '../copy/gameplayEventAnnouncement';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import type {
    BoardTurnResolvedEvent,
    GameplayFeedbackPresentation
} from '../store/gameplayFeedbackAdapter';
import {
    GAUNTLET_WARN_SECS,
    gauntletMessageForThreshold
} from '../copy/hudActionFeedback';

export {
    formatHudActionFeedbackText,
    getFindableToastText
} from '../copy/hudActionFeedback';

/** Min interval between polite live-region updates (anti-spam for screen readers). */
const POLITE_HUD_THROTTLE_MS = 400;

type HudAnnouncePriority = 'info' | 'error';

const PRIORITY_RANK: Record<HudAnnouncePriority, number> = { error: 2, info: 1 };

interface HudPoliteLiveAnnouncementInput {
    boardTurnEvent?: BoardTurnResolvedEvent | null;
    gameplayFeedbackBatch?: readonly GameplayFeedbackPresentation[];
    gauntletRemainingMs: number | null;
    gauntletActive: boolean;
    boardLevel: number | null;
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

const EMPTY_GAMEPLAY_FEEDBACK_BATCH: readonly GameplayFeedbackPresentation[] = [];

/**
 * HUD-015: polite `aria-live` source text for timer buckets and typed gameplay consequences.
 * Batches concurrent announcements on `requestAnimationFrame`, dedupes by key, prefers higher priority,
 * and throttles display cadence so screen readers get summaries, not chatter.
 */
export const useHudPoliteLiveAnnouncement = ({
    boardTurnEvent = null,
    gameplayFeedbackBatch = EMPTY_GAMEPLAY_FEEDBACK_BATCH,
    gauntletRemainingMs,
    gauntletActive,
    boardLevel,
    gambitThirdPickActive,
    gambitOpportunityFlippedIds,
    reduceMotion = false
}: HudPoliteLiveAnnouncementInput): UseHudPoliteLiveAnnouncementResult => {
    const [message, setMessage] = useState('');
    const [messagePriority, setMessagePriority] = useState<HudAnnouncePriority>('info');
    const prevGauntletSecsRef = useRef<number | null>(null);
    const announcedBoardTurnEventIdRef = useRef<string | null>(boardTurnEvent?.eventId ?? null);
    const announcedGameplayFeedbackEventIdsRef = useRef(
        new Set(gameplayFeedbackBatch.map((feedback) => feedback.eventId))
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
        if (!boardTurnEvent || boardTurnEvent.eventId === announcedBoardTurnEventIdRef.current) {
            return;
        }
        announcedBoardTurnEventIdRef.current = boardTurnEvent.eventId;
        if (boardTurnEvent.boardLevel !== boardLevel) {
            return;
        }

        const presentation = buildBoardTurnAnnouncement(
            boardTurnEvent,
            gameplayFeedbackBatch,
            { reduceMotion }
        );
        if (presentation.message) {
            queuePoliteAnnouncement(presentation.message, {
                dedupeKey: presentation.dedupeKey,
                priority: presentation.priority
            });
        }
        for (const eventId of presentation.consumedGameplayFeedbackEventIds) {
            announcedGameplayFeedbackEventIdsRef.current.add(eventId);
        }
    }, [boardLevel, boardTurnEvent, gameplayFeedbackBatch, queuePoliteAnnouncement, reduceMotion]);

    useEffect(() => {
        const unannouncedFeedback = gameplayFeedbackBatch.filter(
            (feedback) => !announcedGameplayFeedbackEventIdsRef.current.has(feedback.eventId)
        );
        const presentation = buildGameplayEventBatchAnnouncement(unannouncedFeedback);
        if (!presentation) {
            return;
        }
        queuePoliteAnnouncement(presentation.message, {
            dedupeKey: presentation.dedupeKey,
            priority: presentation.priority
        });
        for (const eventId of presentation.consumedEventIds) {
            announcedGameplayFeedbackEventIdsRef.current.add(eventId);
        }
    }, [gameplayFeedbackBatch, queuePoliteAnnouncement]);

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
