import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelicId } from '../../shared/contracts';
import { playRelicChoiceCrescendoSfx, resumeAudioContext } from '../audio/gameSfx';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';

vi.mock('../audio/gameSfx', () => ({
    playRelicChoiceCrescendoSfx: vi.fn(),
    resumeAudioContext: vi.fn()
}));

describe('RelicDraftOfferPanel', () => {
    beforeEach(() => {
        vi.mocked(playRelicChoiceCrescendoSfx).mockClear();
        vi.mocked(resumeAudioContext).mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders one card per relic with tier, build tag, effect and one impact line', () => {
        const onPick = vi.fn();
        render(
            <RelicDraftOfferPanel
                currentRelicIds={['guard_token_plus_one']}
                descriptionById={
                    {
                        region_shuffle_free_first: 'First row swap is free each floor.',
                        peek_charge_plus_one: '+1 peek charge.',
                        guard_token_plus_one: '+1 guard token.'
                    } as Record<RelicId, string>
                }
                onPick={onPick}
                optionIds={['region_shuffle_free_first', 'peek_charge_plus_one', 'guard_token_plus_one']}
                pickRound={0}
                reasonById={{ peek_charge_plus_one: 'Offered because the last floor lost a life to a hidden hazard.' }}
                serviceActions={[
                    {
                        available: true,
                        cost: 2,
                        description: 'Spend shop gold to roll a fresh relic trio once this draft round.',
                        effectPreview: 'Fresh choices',
                        label: 'Reroll offer',
                        serviceId: 'reroll_offer',
                        unavailableReason: null,
                        usedThisRound: 0
                    },
                    {
                        available: false,
                        cost: 3,
                        description: 'Bias the visible choices toward rare relics.',
                        effectPreview: 'Favor rare picks',
                        label: 'Upgrade offer',
                        serviceId: 'upgrade_offer',
                        unavailableReason: 'Not enough gold',
                        usedThisRound: 0
                    }
                ]}
            />
        );

        const cards = screen.getAllByTestId('relic-offer-card');
        expect(cards).toHaveLength(3);
        expect(cards[0]).toHaveTextContent('First row swap is free each floor.');
        expect(cards[0]).toHaveAttribute('data-rarity');
        expect(cards[1]).toHaveTextContent('Offered because the last floor lost a life to a hidden hazard.');
        expect(cards[2]).toHaveTextContent('Already owned. Stacks.');
        // The lane map, payoff engine and pick-plan strips are gone.
        expect(screen.queryByTestId('relic-draft-lane-map')).toBeNull();
        expect(screen.queryByTestId('relic-pick-pulse')).toBeNull();
        expect(screen.getByText('Pick one. It stays for the rest of the run.')).toBeInTheDocument();

        const services = screen.getByTestId('relic-offer-services');
        expect(within(services).getByRole('button', { name: /reroll offer/i })).toBeEnabled();
        expect(within(services).getByRole('button', { name: /upgrade offer/i })).toBeDisabled();
        expect(services).toHaveTextContent('3g · Not enough gold');

        fireEvent.click(cards[1]!);
        expect(onPick).toHaveBeenCalledWith('peek_charge_plus_one');
    });

    it('moves focus between cards with the arrow keys', () => {
        render(
            <RelicDraftOfferPanel
                descriptionById={{ peek_charge_plus_one: '+1 peek charge.', guard_token_plus_one: '+1 guard token.' } as Record<RelicId, string>}
                onPick={vi.fn()}
                optionIds={['peek_charge_plus_one', 'guard_token_plus_one']}
                pickRound={0}
            />
        );
        const [first, second] = screen.getAllByTestId('relic-offer-card');
        first!.focus();
        fireEvent.keyDown(screen.getByRole('group', { name: /relic choices/i }), { key: 'ArrowRight' });
        expect(second).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('group', { name: /relic choices/i }), { key: 'ArrowRight' });
        expect(first).toHaveFocus();
    });

    it('plays the choice sting once per focused or hovered card per round', () => {
        render(
            <RelicDraftOfferPanel
                descriptionById={{ peek_charge_plus_one: '+1 peek charge.', guard_token_plus_one: '+1 guard token.' } as Record<RelicId, string>}
                onPick={vi.fn()}
                optionIds={['peek_charge_plus_one', 'guard_token_plus_one']}
                pickRound={0}
                sfxGain={0.75}
            />
        );
        const [first, second] = screen.getAllByTestId('relic-offer-card');
        fireEvent.mouseEnter(first!);
        fireEvent.focus(first!);
        fireEvent.mouseEnter(second!);
        expect(playRelicChoiceCrescendoSfx).toHaveBeenCalledTimes(2);
        expect(resumeAudioContext).toHaveBeenCalledTimes(2);
    });

    it('drops a queued round announcement when that round is no longer current', async () => {
        const pendingMicrotasks: VoidFunction[] = [];
        vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
            pendingMicrotasks.push(callback);
        });
        const panelForRound = (pickRound: number) => (
            <RelicDraftOfferPanel
                descriptionById={{ extra_shuffle_charge: '+1 shuffle charge.' } as Record<RelicId, string>}
                onPick={vi.fn()}
                optionIds={['extra_shuffle_charge']}
                pickRound={pickRound}
            />
        );
        const { rerender } = render(panelForRound(0));

        rerender(panelForRound(1));
        expect(pendingMicrotasks).toHaveLength(1);

        rerender(panelForRound(0));
        await act(async () => {
            pendingMicrotasks.shift()?.();
        });

        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('re-arms the live region before repeating a round announcement', async () => {
        vi.useFakeTimers();
        const panelForRound = (pickRound: number) => (
            <RelicDraftOfferPanel
                descriptionById={{ extra_shuffle_charge: '+1 shuffle charge.' } as Record<RelicId, string>}
                onPick={vi.fn()}
                optionIds={['extra_shuffle_charge']}
                pickRound={pickRound}
            />
        );
        const { rerender, unmount } = render(panelForRound(0));

        try {
            rerender(panelForRound(1));
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByRole('status')).toBeEmptyDOMElement();
            act(() => {
                vi.advanceTimersByTime(0);
            });
            expect(screen.getByRole('status')).toHaveTextContent('The shrine redraws new relic choices.');

            rerender(panelForRound(2));
            await act(async () => {
                await Promise.resolve();
            });
            expect(screen.getByRole('status')).toBeEmptyDOMElement();
            act(() => {
                vi.advanceTimersByTime(0);
            });
            expect(screen.getByRole('status')).toHaveTextContent('The shrine redraws new relic choices.');
        } finally {
            unmount();
            vi.useRealTimers();
        }
    });
});
