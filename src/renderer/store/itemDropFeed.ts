import { create } from 'zustand/react';
import type { GameplayEventJournalEntry, RunState } from '../../shared/contracts';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { hourglassCalloutSub, ODD_CARD_COPY } from '../copy/oddCardBeat';
import { itemDropFromCallout, type ItemDrop } from '../components/itemDrops';
import { derivePurchaseCallouts, type ScreenCallout } from '../components/screenCallouts';

/**
 * The item drops waiting to be shown (`ItemDropPopup.tsx`), fed from the run itself rather than
 * from the game screen. A camp upgrade lands as the next floor is built, the moment the game
 * screen remounts behind its loading screen, so a drop derived inside the screen took the new
 * purchase as its starting point and was never shown. This store outlives the screen.
 */
export const useItemDropFeed = create<{ queue: readonly ItemDrop[] }>(() => ({ queue: [] }));

/** How many drops may wait at once; a burst of purchases shows its last few. */
export const ITEM_DROP_QUEUE_LIMIT = 6;

export const enqueueItemDrops = (drops: readonly ItemDrop[]): void => {
    if (drops.length === 0) return;
    useItemDropFeed.setState((state) => {
        const queued = new Set(state.queue.map((drop) => drop.key));
        return { queue: [...state.queue, ...drops.filter((drop) => !queued.has(drop.key))].slice(-ITEM_DROP_QUEUE_LIMIT) };
    });
};

export const dismissItemDrop = (): void => useItemDropFeed.setState((state) => ({ queue: state.queue.slice(1) }));

export const clearItemDrops = (): void => {
    stingPlayedFor = null;
    useItemDropFeed.setState({ queue: [] });
};

let stingPlayedFor: string | null = null;
/** True the first time a drop's sting is asked for; false after, so a remount does not replay it. */
export const claimItemDropSting = (key: string): boolean => {
    if (stingPlayedFor === key) return false;
    stingPlayedFor = key;
    return true;
};

const journalIds = (journal: readonly GameplayEventJournalEntry[] | undefined): Set<string> =>
    new Set((Array.isArray(journal) ? journal : []).map((entry) => entry.eventId));

/**
 * What the player got between two states of one run: purchases, pickups claimed with a match, an
 * Hourglass's prize. A different run (a new one, a restore) is a fresh start, not a drop.
 */
export const itemDropsBetween = (before: RunState | null | undefined, after: RunState | null | undefined): ItemDrop[] => {
    if (!before || !after || before.runSeed !== after.runSeed || before === after) return [];
    const callouts: ScreenCallout[] = [];
    if (before.storePurchases !== after.storePurchases) callouts.push(...derivePurchaseCallouts(before.storePurchases, after.storePurchases));
    if (before.gameplayEventJournal !== after.gameplayEventJournal) {
        const seen = journalIds(before.gameplayEventJournal);
        for (const entry of Array.isArray(after.gameplayEventJournal) ? after.gameplayEventJournal : []) {
            if (seen.has(entry.eventId) || entry.type !== 'board.turn_resolved') continue;
            const kind = (entry as unknown as { matchedFindableKind?: string | null }).matchedFindableKind;
            if (kind === 'score_glint' || kind === 'meteor_shard') {
                callouts.push({ key: `pickup:${entry.eventId}`, kind: 'pickup', size: 'minor', tone: 'cyan', title: getFindableKindLabel(kind).toUpperCase(), sub: getFindableRewardCopy(kind), drop: kind });
            }
        }
    }
    const hourglass = after.lastHourglassEvent;
    if (hourglass && hourglass.kind === 'caught' && hourglass.key !== before.lastHourglassEvent?.key) {
        callouts.push({ key: hourglass.key, kind: 'pickup', size: 'minor', tone: 'gold', title: ODD_CARD_COPY.caughtTitle, sub: hourglassCalloutSub(hourglass), drop: 'hourglass_prize' });
    }
    return callouts.map(itemDropFromCallout).filter((drop): drop is ItemDrop => drop !== null);
};
