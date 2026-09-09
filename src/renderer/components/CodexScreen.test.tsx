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
        expect(tabs.length).toBe(12);
        expect(within(rail).getByRole('tab', { name: /^Residents/ })).toBeInTheDocument();
        expect(within(rail).getByRole('tab', { name: /^Core/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText(/filter topics/i)).toBeInTheDocument();

        const entries = screen.getByTestId('codex-entries');
        expect(within(entries).getAllByRole('listitem').length).toBeGreaterThan(0);
        expect(entries).toHaveTextContent('Pairs and matching');
        expect(screen.queryByTestId('codex-knowledge-base-summary')).toBeNull();
        expect(screen.queryByTestId('codex-reward-signal')).toBeNull();
    });

    it('switches sections from the rail and documents traits', () => {
        render(<CodexScreen />);

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
                setter.call(input, 'peek');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            act(() => {
                vi.advanceTimersByTime(200);
            });
            const entries = screen.getByTestId('codex-entries');
            expect(entries).toHaveTextContent(/peek/i);
            // "peek" hits the Peek power, the findables article ("Peek only reveals it") and the
            // Conduit + Echo interaction, in three sections. The fitted pages are walked because
            // that is how a player reaches a hit that does not sit on the first one; every hit on
            // every page carries the section it came from.
            const seenSections = new Set<string>();
            let sawTraitLine = false;
            for (let page = 0; page < 8; page += 1) {
                for (const item of within(entries).getAllByRole('listitem')) {
                    const section = item.querySelector('[data-section]')?.getAttribute('data-section');
                    expect(section).toBeTruthy();
                    seenSections.add(section ?? '');
                }
                if (entries.textContent?.includes('Conduit + Echo: peek spark')) {
                    sawTraitLine = true;
                }
                const next = screen.getByRole('button', { name: /^next$/i });
                if ((next as HTMLButtonElement).disabled) break;
                act(() => {
                    next.click();
                });
            }
            expect(seenSections.has('pickups')).toBe(true);
            expect(seenSections.has('traits')).toBe(true);
            expect(sawTraitLine).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
