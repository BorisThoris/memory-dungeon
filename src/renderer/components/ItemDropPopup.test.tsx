import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDropPopup } from './ItemDropPopup';
import { ITEM_DROP_HOLD_MS, itemDropFromCallout, itemDropRarity, type ItemDrop } from './itemDrops';
import { derivePurchaseCallouts } from './screenCallouts';

const drop = (key: string, extra: Partial<ItemDrop> = {}): ItemDrop => ({ key, id: 'meteor_shard', rarity: 'rare', glyph: 'comet', name: 'Meteor shard', line: '+1 meteor', ...extra });

describe('item drops', () => {
    beforeEach(() => vi.useFakeTimers());
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

    it('shows nothing it opened on, then each new drop in turn, for its rarity’s time', () => {
        const onShow = vi.fn();
        const { rerender } = render(<ItemDropPopup drops={[drop('old')]} onShow={onShow} reduceMotion={false} />);
        expect(screen.queryByTestId('item-drop')).toBeNull();
        rerender(<ItemDropPopup drops={[drop('old'), drop('a'), drop('b', { rarity: 'common', name: 'Score glint' })]} onShow={onShow} reduceMotion={false} />);
        expect(screen.getByTestId('item-drop')).toHaveAttribute('data-rarity', 'rare');
        expect(onShow).toHaveBeenCalledTimes(1);
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
        const { rerender } = render(<ItemDropPopup drops={[]} reduceMotion />);
        rerender(<ItemDropPopup drops={[drop('a')]} reduceMotion />);
        expect(screen.getByRole('status')).toHaveTextContent('Rare item: Meteor shard. +1 meteor');
        fireEvent.click(screen.getByTestId('item-drop'));
        expect(screen.queryByTestId('item-drop')).toBeNull();
        rerender(<ItemDropPopup drops={[drop('a'), drop('b')]} reduceMotion />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByTestId('item-drop')).toBeNull();
    });
});
