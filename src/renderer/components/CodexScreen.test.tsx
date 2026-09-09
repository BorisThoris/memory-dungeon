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
                setter.call(input, 'spark');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            act(() => {
                vi.advanceTimersByTime(200);
            });
            const entries = screen.getByTestId('codex-entries');
            expect(entries).toHaveTextContent(/spark/i);
            // Every hit carries the section it came from, whichever section that is.
            const sections = within(entries)
                .getAllByRole('listitem')
                .map((item) => item.querySelector('[data-section]')?.getAttribute('data-section'));
            expect(sections.every(Boolean)).toBe(true);
            expect(sections).toContain('scoring');
            // The trait interaction lives in another section and the one filter reaches it.
            expect(sections).toContain('traits');
            // "spark" hits the shard article, the findables article and the Conduit + Echo
            // interaction. The first fitted page has six slots, so all three fit on it today; the
            // pager is still walked, because it is how a player reaches a hit that does not.
            const pageTo = (text: string): void => {
                for (let page = 0; page < 6 && !entries.textContent?.includes(text); page += 1) {
                    const next = screen.getByRole('button', { name: /^next$/i });
                    if ((next as HTMLButtonElement).disabled) break;
                    act(() => {
                        next.click();
                    });
                }
            };
            pageTo('Conduit + Echo: peek spark');
            expect(entries).toHaveTextContent('Conduit + Echo: peek spark');
        } finally {
            vi.useRealTimers();
        }
    });
});
