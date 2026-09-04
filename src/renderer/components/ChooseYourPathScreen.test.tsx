import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMutatorCatalogRows } from '../../shared/game-catalog';
import { RUN_MODE_CATALOG } from '../../shared/run-mode-catalog';

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
import ChooseYourPathScreen from './ChooseYourPathScreen';
import { buildMeditationPickMutatorRows } from './chooseYourPathScreenModel';

const storeSpies = vi.hoisted(() => ({
    startRun: vi.fn(),
    startDungeonShowcaseRun: vi.fn(),
    startDailyRun: vi.fn(),
    startGauntletRun: vi.fn()
}));

vi.mock('../audio/uiSfx', () => ({
    playMenuOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', async () => {
    const { createDefaultSaveData } = await import('../../shared/save-data');
    const saveData = createDefaultSaveData();
    const state = {
        closeSubscreen: vi.fn(),
        openSettings: vi.fn(),
        saveData,
        settings: saveData.settings,
        startDailyRun: storeSpies.startDailyRun,
        startDungeonShowcaseRun: storeSpies.startDungeonShowcaseRun,
        startGauntletRun: storeSpies.startGauntletRun,
        startMeditationRun: vi.fn(),
        startMeditationRunWithMutators: vi.fn(),
        startPinVowRun: vi.fn(),
        startPracticeRun: vi.fn(),
        startPuzzleRun: vi.fn(),
        startRun: storeSpies.startRun,
        startScholarContractRun: vi.fn(),
        startWildRun: vi.fn()
    };
    return {
        useAppStore: (selector: (s: typeof state) => unknown) => selector(state)
    };
});

describe('ChooseYourPathScreen', () => {
    beforeEach(() => {
        Object.values(storeSpies).forEach((spy) => spy.mockClear());
    });

    it('recommends Classic Run to a fresh profile and starts it in one click', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const launcher = screen.getByRole('region', { name: /recommended run/i });
        expect(within(launcher).getByRole('heading', { name: /^classic run$/i })).toBeInTheDocument();
        expect(within(launcher).getByTestId('choose-path-first-run-beats').children).toHaveLength(3);

        await user.click(within(launcher).getByRole('button', { name: /^start run$/i }));
        expect(storeSpies.startRun).toHaveBeenCalledTimes(1);
    });

    it('lets a player reach every catalog mode through the filter, paged grid or not', async () => {
        // The browse grid is paged, so "is the tile on screen right now" is the wrong question: the
        // filter is how a player asks for a mode by name. Every mode the catalog declares has to
        // come back from it, or the mode is content nothing can start.
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        // The one mode that is never in the browse grid is the one already on the launcher, which
        // is reachable in one click instead. Which mode that is depends on the profile, so read it
        // off the launcher rather than hardcoding a title.
        const launcher = screen.getByRole('region', { name: /recommended run/i });
        const launchTitle = within(launcher).getByRole('heading', { level: 2 }).textContent?.trim() ?? '';
        expect(within(launcher).getByRole('button', { name: /^start run$/i })).toBeInTheDocument();

        const browse = screen.getByRole('region', { name: /browse modes/i });
        const filter = screen.getByLabelText(/filter modes/i);
        const unreachable: string[] = [];
        for (const def of RUN_MODE_CATALOG.filter((mode) => mode.title !== launchTitle)) {
            await user.clear(filter);
            await user.type(filter, def.title);
            const tile = within(browse).queryAllByRole('button', {
                name: new RegExp(`^${escapeForRegExp(def.title)}\\. Open details\\.$`, 'iu')
            });
            if (tile.length === 0) {
                unreachable.push(def.id);
            }
        }
        expect(unreachable, 'catalog modes the filter cannot surface').toEqual([]);
    });

    it('states each browse mode once: group, title, one description, locked tag where it applies', () => {
        render(<ChooseYourPathScreen />);

        const browse = screen.getByRole('region', { name: /browse modes/i });
        const endless = within(browse).getByRole('button', { name: /^Endless Mode\. Open details\.$/i });
        expect(endless).toHaveTextContent(/core modes/i);
        expect(endless).toHaveTextContent('In the full game');
        // The taxonomy strips are gone: a card carries no "lanes" or "launch loop" copy.
        expect(browse).not.toHaveTextContent(/launch loop|chain leads|read pressure|chase reward/i);
        // The tile's accessible name is the title alone, which is what the e2e harness matches.
        expect(within(browse).getByRole('button', { name: /^Daily Challenge\. Open details\.$/i })).toBeInTheDocument();
    });

    it('filters the library by title or description', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.type(screen.getByRole('searchbox', { name: /filter modes/i }), 'gauntlet');
        const browse = screen.getByRole('region', { name: /browse modes/i });
        expect(within(browse).getByRole('button', { name: /^Gauntlet\. Open details\.$/i })).toBeInTheDocument();
        expect(within(browse).queryByRole('button', { name: /^Daily Challenge\. Open details\.$/i })).not.toBeInTheDocument();
    });

    it('opens a mode in the detail modal and plays it from there', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Daily Challenge\. Open details\.$/i }));
        const modal = screen.getByTestId('library-mode-detail-modal');
        expect(within(modal).getByText(/shared daily mutators/i)).toBeInTheDocument();
        await user.click(within(modal).getByRole('button', { name: /^play$/i }));
        expect(storeSpies.startDailyRun).toHaveBeenCalledTimes(1);
    });

    it('keeps locked modes visible and explains the lock in the modal', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Endless Mode\. Open details\.$/i }));
        const modal = screen.getByTestId('library-mode-detail-modal');
        expect(within(modal).getByText(/locked intentionally/i)).toBeInTheDocument();
        expect(within(modal).queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument();
    });

    it('offers gauntlet durations as presets instead of a generic play button', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Gauntlet\. Open details\.$/i }));
        const presets = within(screen.getByTestId('library-mode-detail-modal')).getByRole('group', { name: /gauntlet duration/i });
        const buttons = within(presets).getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        await user.click(buttons[0]!);
        expect(storeSpies.startGauntletRun).toHaveBeenCalledTimes(1);
    });

    it('renders meditation mutator picks through the shared catalog rows in title order', () => {
        const rows = buildMeditationPickMutatorRows();
        const titles = rows.map((row) => row.title);
        expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
        expect(rows.length).toBeLessThanOrEqual(getMutatorCatalogRows().length);
    });
});
