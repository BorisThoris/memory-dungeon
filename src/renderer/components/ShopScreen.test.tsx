import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunShopOfferState, RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { SHOP_ITEM_CATALOG } from '../../shared/shop-rules';
import { useAppStore } from '../store/useAppStore';
import ShopScreen from './ShopScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    playUiConfirmSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

vi.mock('../audio/uiSfx', () => uiSfxMocks);

const offer = (
    itemId: RunShopOfferState['itemId'],
    overrides: Partial<RunShopOfferState> = {}
): RunShopOfferState => ({
    ...SHOP_ITEM_CATALOG[itemId],
    id: `offer-${itemId}`,
    compatible: true,
    purchased: false,
    unavailableReason: null,
    ...overrides
});

const shopRun = (overrides: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0);
    return {
        ...base,
        status: 'levelComplete',
        shopGold: 4,
        shopRerolls: 0,
        shopOffers: [
            offer('peek_charge', { cost: 2 }),
            offer('region_shuffle_charge', { cost: 6 }),
            offer('trait_cleanse', { cost: 1, compatible: false, unavailableReason: 'No trait to cleanse.' }),
            offer('heal_life', { cost: 3, purchased: true })
        ],
        lastLevelResult: {
            level: 2,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: 4,
            perfect: false,
            mistakes: 1,
            clearLifeReason: 'none',
            clearLifeGained: 0
        },
        ...overrides
    };
};

describe('ShopScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const saveData = createDefaultSaveData();
        useAppStore.setState({ run: null, view: 'menu', shopReturnMode: null, saveData, settings: saveData.settings });
    });

    it('states the purse once and lists every offer with one line, a price and one action', () => {
        act(() => {
            useAppStore.setState({ run: shopRun(), shopReturnMode: 'summary' });
        });
        render(<ShopScreen />);

        const dialog = screen.getByRole('dialog', { name: /vendor alcove/i });
        expect(dialog).toHaveAttribute('data-shop-return-mode', 'summary');
        expect(screen.getByLabelText('4 shop gold')).toHaveTextContent('4g');

        const stock = screen.getByRole('list', { name: /vendor stock/i });
        expect(within(stock).getAllByRole('listitem')).toHaveLength(4);

        const affordable = screen.getByTestId('shop-offer-peek_charge');
        expect(affordable).toHaveAttribute('data-status', 'available');
        expect(within(affordable).getByRole('button', { name: /spend 2g/i })).toBeEnabled();

        const pricey = screen.getByTestId('shop-offer-region_shuffle_charge');
        expect(pricey).toHaveAttribute('data-status', 'insufficient');
        expect(pricey).toHaveTextContent('Not enough shop gold');
        expect(within(pricey).getByRole('button')).toBeDisabled();

        const blocked = screen.getByTestId('shop-offer-trait_cleanse');
        expect(blocked).toHaveAttribute('data-status', 'incompatible');
        expect(blocked).toHaveTextContent('No trait to cleanse.');

        const claimed = screen.getByTestId('shop-offer-heal_life');
        expect(claimed).toHaveAttribute('data-status', 'claimed');
        expect(within(claimed).getByRole('button', { name: /^claimed$/i })).toBeDisabled();

        // The lane map, payoff engine and per-offer signal strips are gone.
        expect(screen.queryByTestId('shop-payoff-engine')).toBeNull();
        expect(screen.queryByTestId('shop-offer-lane-map')).toBeNull();
        expect(dialog.querySelectorAll('[data-testid^="shop-offer-"]')).toHaveLength(4);
    });

    it('buys an offer through the store and plays the click', () => {
        const purchaseShopOffer = vi.fn();
        act(() => {
            useAppStore.setState({ run: shopRun(), shopReturnMode: 'summary', purchaseShopOffer });
        });
        render(<ShopScreen />);

        fireEvent.click(within(screen.getByTestId('shop-offer-peek_charge')).getByRole('button', { name: /spend 2g/i }));
        expect(purchaseShopOffer).toHaveBeenCalledWith('offer-peek_charge');
        expect(uiSfxMocks.playUiClickSfx).toHaveBeenCalledTimes(1);
    });

    it('offers one reroll per visit and marks it spent', () => {
        const rerollShopOffers = vi.fn();
        act(() => {
            useAppStore.setState({ run: shopRun(), shopReturnMode: 'summary', rerollShopOffers });
        });
        const { rerender } = render(<ShopScreen />);

        const reroll = screen.getByTestId('shop-reroll-button');
        expect(reroll).toHaveTextContent(/reroll stock/i);
        fireEvent.click(reroll);
        expect(rerollShopOffers).toHaveBeenCalledTimes(1);

        act(() => {
            useAppStore.setState({ run: shopRun({ shopRerolls: 1 }) });
        });
        rerender(<ShopScreen />);
        expect(screen.getByTestId('shop-reroll-button')).toBeDisabled();
        expect(screen.getByTestId('shop-reroll-button')).toHaveTextContent(/stock rerolled/i);
    });

    it('returns to the floor summary on Back and Escape, and continues to the chosen route floor', () => {
        const closeShopToFloorSummary = vi.fn();
        const continueFromShop = vi.fn();
        act(() => {
            useAppStore.setState({
                run: shopRun({ pendingRouteCardPlan: { choiceId: 'x', routeType: 'greed', sourceLevel: 2, targetLevel: 3 } }),
                shopReturnMode: 'summary',
                closeShopToFloorSummary,
                continueFromShop
            });
        });
        render(<ShopScreen />);

        const dock = screen.getByTestId('shop-action-dock');
        fireEvent.click(within(dock).getByRole('button', { name: /back to floor summary/i }));
        expect(closeShopToFloorSummary).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dock).getByRole('button', { name: /continue to greedy route floor/i }));
        expect(continueFromShop).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(closeShopToFloorSummary).toHaveBeenCalledTimes(2);
        expect(uiSfxMocks.playUiBackSfx).toHaveBeenCalledTimes(2);
    });

    it('labels the in-floor vendor as a return to the board', () => {
        act(() => {
            useAppStore.setState({ run: shopRun({ status: 'playing' }), shopReturnMode: 'floor' });
        });
        render(<ShopScreen />);
        const dock = screen.getByTestId('shop-action-dock');
        expect(within(dock).getByRole('button', { name: /back to board/i })).toBeInTheDocument();
        expect(within(dock).getByRole('button', { name: /return to board/i })).toBeInTheDocument();
    });
});
