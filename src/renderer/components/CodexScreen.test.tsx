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
        expect(tabs.length).toBe(14);
        expect(within(rail).getByRole('tab', { name: /^Residents/ })).toBeInTheDocument();
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
        // Eight archetypes, six cards to a page in jsdom: the rest are one page away, not scrolled to.
        const builds = screen.getByTestId('codex-entries');
        expect(builds).toHaveTextContent('The Conduit Cartographer');
        // The card carries the opening sentence; the rest of the entry is one click away
        // rather than clamped out of sight.
        const cartographer = within(builds).getByRole('button', { name: /The Conduit Cartographer/ });
        act(() => {
            cartographer.click();
        });
        expect(screen.getByTestId('codex-entry')).toHaveTextContent(/peek, pin, read/i);
        act(() => {
            screen.getByTestId('codex-entry-back').click();
        });
        expect(screen.getByTestId('codex-entries')).toBeInTheDocument();
        const pager = screen.getByTestId('codex-entries-pager');
        expect(pager).toHaveTextContent('of 8 entries');
        act(() => {
            within(pager).getByRole('button', { name: /^next$/i }).click();
        });
        expect(screen.getByTestId('codex-entries')).toHaveTextContent('The Emergency Toolkit');

        act(() => {
            screen.getByRole('tab', { name: /^Traits/ }).click();
        });
        // Traits and their interactions are one section; the first page shows the traits.
        const traits = screen.getByTestId('codex-entries');
        expect(traits).toHaveTextContent('Echo');
        expect(within(traits).getAllByRole('listitem').length).toBeGreaterThan(0);
        expect(screen.getByRole('tab', { name: /^Traits/ })).toHaveAttribute('aria-selected', 'true');
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
            expect(entries).toHaveTextContent(/combo shard/i);
            // Every hit carries the section it came from, whichever section that is.
            const sections = within(entries)
                .getAllByRole('listitem')
                .map((item) => item.querySelector('[data-section]')?.getAttribute('data-section'));
            expect(sections.every(Boolean)).toBe(true);
            expect(sections).toContain('scoring');
            // The trait interaction lives in another section and the one filter reaches it.
            expect(sections).toContain('traits');
            expect(entries).toHaveTextContent('Echo + Sealed: combo shard');
        } finally {
            vi.useRealTimers();
        }
    });
});
