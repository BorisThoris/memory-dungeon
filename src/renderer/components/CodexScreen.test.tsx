import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import CodexScreen from './CodexScreen';

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) =>
        selector({
            closeSubscreen: vi.fn(),
            saveData: createDefaultSaveData(),
            settings: { masterVolume: 0, sfxVolume: 0 }
        })
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));

describe('CodexScreen', () => {
    it('opens on the Core section with one rail, one filter and one grid of entries', () => {
        render(<CodexScreen />);

        const rail = screen.getByRole('tablist', { name: /codex sections/i });
        const tabs = within(rail).getAllByRole('tab');
        expect(tabs.length).toBe(13);
        expect(within(rail).getByRole('tab', { name: /^Core/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText(/filter topics/i)).toBeInTheDocument();

        const entries = screen.getByTestId('codex-entries');
        expect(within(entries).getAllByRole('listitem').length).toBeGreaterThan(0);
        expect(entries).toHaveTextContent('Pairs and matching');
        expect(screen.queryByTestId('codex-knowledge-base-summary')).toBeNull();
        expect(screen.queryByTestId('codex-reward-signal')).toBeNull();
    });

    it('switches sections from the rail and documents build archetypes and traits', () => {
        render(<CodexScreen />);

        act(() => {
            screen.getByRole('tab', { name: /^Builds/ }).click();
        });
        expect(screen.getByRole('tab', { name: /^Builds/ })).toHaveAttribute('aria-selected', 'true');
        const builds = screen.getByTestId('codex-entries');
        expect(builds).toHaveTextContent('The Conduit Cartographer');
        expect(builds).toHaveTextContent('The Emergency Toolkit');
        expect(builds).toHaveTextContent(/peek, pin, read/i);

        act(() => {
            screen.getByRole('tab', { name: /^Traits/ }).click();
        });
        const traits = screen.getByTestId('codex-entries');
        expect(traits).toHaveTextContent('Echo');
        expect(traits).toHaveTextContent('Echo + Sealed: combo shard');
        expect(traits).toHaveTextContent(/Match Echo next to a different Sealed trait pair/i);
    });

    it('filters every section at once and labels each hit with its section', async () => {
        vi.useFakeTimers();
        try {
            render(<CodexScreen />);
            const input = screen.getByLabelText(/filter topics/i) as HTMLInputElement;
            act(() => {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
                setter.call(input, 'combo shard');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            act(() => {
                vi.advanceTimersByTime(200);
            });
            const entries = screen.getByTestId('codex-entries');
            const kickers = within(entries)
                .getAllByRole('listitem')
                .map((item) => item.getAttribute('data-section'));
            expect(new Set(kickers).size).toBeGreaterThan(1);
            expect(entries).toHaveTextContent(/combo shard/i);
        } finally {
            vi.useRealTimers();
        }
    });
});
