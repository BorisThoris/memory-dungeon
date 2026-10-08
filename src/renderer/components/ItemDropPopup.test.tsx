import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDropPopup } from './ItemDropPopup';
import { ITEM_DROP_HOLD_MS, itemDropFromCallout, itemDropRarity, type ItemDrop } from './itemDrops';
import { derivePurchaseCallouts } from './screenCallouts';
import { clearItemDrops, enqueueItemDrops, itemDropsBetween } from '../store/itemDropFeed';
import { createNewRun } from '../../shared/game';
import type { GameplayEventJournalEntry } from '../../shared/contracts';

const drop = (key: string, extra: Partial<ItemDrop> = {}): ItemDrop => ({ key, id: 'meteor_shard', rarity: 'rare', glyph: 'comet', name: 'Meteor shard', line: '+1 meteor', ...extra });

describe('item drops', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearItemDrops();
    });
    afterEach(() => vi.useRealTimers());

    it('grades rarity the way loot reads: consumables common, shards rare, relics epic', () => {
        expect(itemDropRarity('score_glint')).toBe('common');
        expect(itemDropRarity('miss')).toBe('common');
        expect(itemDropRarity('bomb')).toBe('uncommon');
        expect(itemDropRarity('meteor_shard')).toBe('rare');
        expect(itemDropRarity('deep_pockets')).toBe('epic');
    });

    it('a purchase is a drop, carried on the stamp that used to show it', () => {
        const [callout] = derivePurchaseCallouts({}, { deep_pockets: 1 });
        const fromStamp = itemDropFromCallout(callout!);
        expect(fromStamp).toMatchObject({ id: 'deep_pockets', rarity: 'epic', glyph: 'gem', name: 'Deep pockets' });
    });

    it('a camp upgrade bought as the next floor builds is a drop; a new run or a restore is not', () => {
        const run = createNewRun(0, { runSeed: 5 });
        const next = { ...run, storePurchases: { long_look: 1 } };
        expect(itemDropsBetween(run, next).map((drop) => drop.id)).toEqual(['long_look']);
        expect(itemDropsBetween(null, next)).toEqual([]);
        expect(itemDropsBetween({ ...run, runSeed: 6 }, next)).toEqual([]);
    });

    it('a pickup claimed with a match is a drop, read off the journal entry once', () => {
        const run = createNewRun(0, { runSeed: 5 });
        const claim = { eventId: 'turn-1', type: 'board.turn_resolved', matchedFindableKind: 'meteor_shard' } as unknown as GameplayEventJournalEntry;
        const after = { ...run, gameplayEventJournal: [...(run.gameplayEventJournal ?? []), claim] };
        expect(itemDropsBetween(run, after)).toMatchObject([{ key: 'pickup:turn-1', id: 'meteor_shard', rarity: 'rare' }]);
        expect(itemDropsBetween(after, { ...after, gameplayEventJournal: [...after.gameplayEventJournal!] })).toEqual([]);
    });

    it('shows each drop in turn, for its rarity\u2019s time, and outlives the screen remounting', () => {
        const onShow = vi.fn();
        const { unmount } = render(<ItemDropPopup onShow={onShow} reduceMotion={false} />);
        act(() => enqueueItemDrops([drop('a'), drop('b', { rarity: 'common', name: 'Score glint' })]));
        expect(screen.getByTestId('item-drop')).toHaveAttribute('data-rarity', 'rare');
        // The game screen remounts as the next floor builds: the drop is still there.
        unmount();
        render(<ItemDropPopup onShow={onShow} reduceMotion={false} />);
        expect(screen.getByTestId('item-drop')).toHaveAttribute('data-rarity', 'rare');
        act(() => {
            vi.advanceTimersByTime(ITEM_DROP_HOLD_MS.rare + 10);
        });
        expect(screen.getByTestId('item-drop')).toHaveAttribute('data-rarity', 'common');
        act(() => {
            vi.advanceTimersByTime(ITEM_DROP_HOLD_MS.common + 10);
        });
        expect(screen.queryByTestId('item-drop')).toBeNull();
    });

    it('a tap or a key skips it, and a screen reader hears what it was', () => {
        render(<ItemDropPopup reduceMotion />);
        act(() => enqueueItemDrops([drop('a'), drop('b')]));
        expect(screen.getByRole('status')).toHaveTextContent('Rare item: Meteor shard. +1 meteor');
        fireEvent.click(screen.getByTestId('item-drop'));
        expect(screen.getByTestId('item-drop')).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByTestId('item-drop')).toBeNull();
    });
});
