import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OverlayModal from './OverlayModal';
import { getOverlayDecisionPolicyRows } from '../../shared/overlay-decision-policy';
import { syncToolbarTabIndices } from '../a11y/toolbarRoving';

describe('OverlayModal (REF-061)', () => {
    it('keeps underlying toolbar resyncs out of the tab order until close', () => {
        const renderTree = (showModal: boolean) => (
            <>
                <div aria-label="Game controls" role="toolbar">
                    <button type="button">Inventory</button>
                    <button type="button">Settings</button>
                </div>
                {showModal ? <OverlayModal actions={[]} title="Paused" /> : null}
            </>
        );
        const { rerender } = render(renderTree(true));
        const toolbar = screen.getByRole('toolbar', { name: 'Game controls' });
        const inventory = screen.getByRole('button', { name: 'Inventory' });
        const settings = screen.getByRole('button', { name: 'Settings' });

        syncToolbarTabIndices(toolbar, settings);

        expect(inventory).toHaveAttribute('tabindex', '-1');
        expect(settings).toHaveAttribute('tabindex', '-1');

        rerender(renderTree(false));

        expect(inventory).toHaveAttribute('tabindex', '-1');
        expect(settings).toHaveAttribute('tabindex', '0');
    });

    it('keeps the global modal-open state until the last nested overlay closes', () => {
        const { rerender, unmount } = render(
            <>
                <OverlayModal actions={[]} testId="first-modal" title="First modal" />
                <OverlayModal actions={[]} testId="second-modal" title="Second modal" />
            </>
        );

        expect(document.body.dataset.overlayModalOpen).toBe('true');

        rerender(<OverlayModal actions={[]} testId="second-modal" title="Second modal" />);

        expect(screen.queryByTestId('first-modal')).toBeNull();
        expect(document.body.dataset.overlayModalOpen).toBe('true');

        unmount();

        expect(document.body.dataset.overlayModalOpen).toBeUndefined();
    });

    it('Tab cycles only between modal actions while the dialog is open', async () => {
        const user = userEvent.setup();
        render(
            <OverlayModal
                actions={[
                    { label: 'Continue', onClick: () => {} },
                    { label: 'Quit', onClick: () => {} }
                ]}
                testId="unit-modal"
                title="Paused"
            />
        );

        const continueBtn = screen.getByRole('button', { name: 'Continue' });
        const quitBtn = screen.getByRole('button', { name: 'Quit' });
        continueBtn.focus();
        expect(document.activeElement).toBe(continueBtn);

        await user.tab();
        expect(document.activeElement).toBe(quitBtn);

        await user.tab();
        expect(document.activeElement).toBe(continueBtn);
    });

    it('REG-008 exposes mobile-safe scroll body and sticky action footer hooks', () => {
        render(
            <OverlayModal
                actions={[
                    { label: 'Confirm', onClick: () => {} },
                    { label: 'Cancel', onClick: () => {}, variant: 'secondary' }
                ]}
                testId="unit-modal"
                title="Floor cleared"
            >
                <p>Detailed reward, objective, relic, and shop text can scroll inside the controlled modal body.</p>
            </OverlayModal>
        );

        expect(screen.getByTestId('overlay-modal-body')).toHaveTextContent('Detailed reward');
        expect(screen.getByTestId('overlay-modal-actions')).toHaveTextContent('Confirm');
        expect(screen.getByTestId('unit-modal')).toHaveAttribute('data-overlay-size', 'decision');
    });

    it('DS-010 quiet header plate skips MetaFrame cornice for routine summaries', () => {
        render(
            <OverlayModal
                actions={[{ label: 'Continue', onClick: () => {} }]}
                headerPlateTone="success"
                ornamentalHeaderPlate
                quietHeaderPlate
                title="Floor cleared"
            />
        );

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByTestId('overlay-modal-quiet-header')).toHaveTextContent('Floor cleared');
        expect(dialog.querySelector('svg')).toBeNull();
    });

    it('REG-097 exposes decision sheet policy for keyboard and one-hand paths', () => {
        render(
            <OverlayModal
                actions={[
                    { label: 'Resume', onClick: () => {} },
                    { label: 'Main Menu', onClick: () => {}, variant: 'secondary' }
                ]}
                testId="unit-modal"
                title="Run paused"
            />
        );

        expect(getOverlayDecisionPolicyRows().map((row) => row.modalKind)).toEqual(['alert', 'decision', 'sheet']);
        expect(screen.getByTestId('unit-modal')).toHaveAttribute('data-keyboard-contract', 'Tab trap + initial focus + focus restore');
        expect(screen.getByTestId('unit-modal')).toHaveAttribute('data-one-hand-placement', 'sticky action rail / mobile bottom-safe area');
    });

    it('REG-097 calls the optional keyboard back path on Escape', async () => {
        const user = userEvent.setup();
        const onEscape = vi.fn();
        render(
            <OverlayModal
                actions={[{ label: 'Resume', onClick: () => {} }]}
                onEscape={onEscape}
                testId="unit-modal"
                title="Run paused"
            />
        );

        await user.keyboard('{Escape}');

        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('keeps Escape inert for required overlays without a back path', async () => {
        const user = userEvent.setup();
        render(<OverlayModal actions={[]} testId="unit-modal" title="Choose a relic" />);

        await user.keyboard('{Escape}');

        expect(screen.getByTestId('unit-modal')).toBeInTheDocument();
    });

    it('does not steal Escape from editable modal fields', async () => {
        const user = userEvent.setup();
        const onEscape = vi.fn();
        render(
            <OverlayModal
                actions={[{ label: 'Close', onClick: () => {} }]}
                onEscape={onEscape}
                testId="unit-modal"
                title="Rename save"
            >
                <label>
                    Save name
                    <input defaultValue="Daily run" />
                </label>
            </OverlayModal>
        );

        await user.click(screen.getByRole('textbox', { name: /save name/i }));
        await user.keyboard('{Escape}');

        expect(onEscape).not.toHaveBeenCalled();
    });

    it('still lets Escape close from checkbox controls in decision sheets', async () => {
        const user = userEvent.setup();
        const onEscape = vi.fn();
        render(
            <OverlayModal
                actions={[{ label: 'Start', onClick: () => {} }]}
                onEscape={onEscape}
                testId="unit-modal"
                title="Meditation setup"
            >
                <label>
                    <input type="checkbox" />
                    Glass floor
                </label>
            </OverlayModal>
        );

        await user.click(screen.getByRole('checkbox', { name: /glass floor/i }));
        await user.keyboard('{Escape}');

        expect(onEscape).toHaveBeenCalledTimes(1);
    });
});
