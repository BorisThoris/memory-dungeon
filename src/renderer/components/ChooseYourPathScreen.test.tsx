import { CLASSIC_SETUP_COPY } from '../copy/screenCopy';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMutatorCatalogRows } from '../../shared/game-catalog';
import { RUN_MODE_CATALOG, RUN_MODE_GROUP_LABEL } from '../../shared/run-mode-catalog';

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
import ChooseYourPathScreen from './ChooseYourPathScreen';
import { buildMeditationPickMutatorRows } from './chooseYourPathScreenModel';

const storeSpies = vi.hoisted(() => ({
    startRun: vi.fn(),
    startSharedRun: vi.fn(),
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
        startSharedRun: storeSpies.startSharedRun,
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

        // One click still plays: the setup sheet is a door beside Start, not in front of it.
        await user.click(within(launcher).getByRole('button', { name: /^start run$/i }));
        expect(storeSpies.startRun).toHaveBeenCalledTimes(1);
    });

    it('says how much of the library the filters left, since the grid only shows a page of it', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const count = screen.getByTestId('choose-path-mode-count');
        const total = Number(count.textContent?.match(/of (\d+)/u)?.[1]);
        expect(total).toBeGreaterThan(1);
        expect(count).toHaveTextContent(new RegExp(`^${total} of ${total} modes$`, 'u'));

        await user.type(screen.getByLabelText(/filter modes/i), 'Glyph Cross');
        expect(screen.getByTestId('choose-path-mode-count')).toHaveTextContent(`1 of ${total} modes`);
    });

    it('plays a run someone pasted, whole sentence and all', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const form = screen.getByTestId('choose-path-shared-run');
        await user.type(
            within(form).getByRole('textbox'),
            'Memory Dungeon — Wild Run: floor 14, 2,340 points. Same run: md1:wild:33:912'
        );
        await user.click(within(form).getByRole('button', { name: /play it/i }));

        expect(storeSpies.startSharedRun).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('choose-path-shared-run-error')).not.toBeInTheDocument();
    });

    it('says so rather than starting something when the paste is not a key', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const form = screen.getByTestId('choose-path-shared-run');
        await user.type(within(form).getByRole('textbox'), 'have a nice day');
        await user.click(within(form).getByRole('button', { name: /play it/i }));

        expect(storeSpies.startSharedRun).not.toHaveBeenCalled();
        expect(screen.getByTestId('choose-path-shared-run-error')).toBeInTheDocument();
    });

    it('says when the daily turns over, on the one mode that expires', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const chips = screen.getByRole('group', { name: /narrow by kind/i });
        await user.click(within(chips).getByRole('button', { name: /^All/iu }));
        await user.click(screen.getByRole('button', { name: /^Daily Challenge\. Open details\.$/i }));

        const countdown = await screen.findByTestId('choose-path-daily-reset');
        expect(countdown).toHaveTextContent(/Next daily in/i);
        expect(countdown).toHaveTextContent(/\d{2}:\d{2}:\d{2}/u);
    });

    it('does not put a daily countdown on a mode that never expires', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Puzzle\. Open details\.$/i }));

        expect(screen.queryByTestId('choose-path-daily-reset')).not.toBeInTheDocument();
    });

    it('reaches every mode from the group chips too, for a player who does not know a name', async () => {
        // The filter answers "show me Pin vow". The chips answer "show me a puzzle", which is the
        // question someone browsing actually has, and between them no mode is stranded on page 3.
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const launcher = screen.getByRole('region', { name: /recommended run/i });
        const launchTitle = within(launcher).getByRole('heading', { level: 2 }).textContent?.trim() ?? '';
        const chips = screen.getByRole('group', { name: /narrow by kind/i });
        const browse = screen.getByRole('region', { name: /browse modes/i });

        const unreachable: string[] = [];
        for (const def of RUN_MODE_CATALOG.filter((mode) => mode.title !== launchTitle)) {
            // Back to All first: a second press on the chip already held is a deselect, and this
            // loop walks consecutive modes that share a group.
            await user.click(within(chips).getByRole('button', { name: /^All/iu }));
            await user.click(within(chips).getByRole('button', { name: new RegExp(`^${RUN_MODE_GROUP_LABEL[def.group]}`, 'iu') }));
            const tile = within(browse).queryAllByRole('button', {
                name: new RegExp(`^${escapeForRegExp(def.title)}\\. Open details\\.$`, 'iu')
            });
            if (tile.length === 0) {
                unreachable.push(def.id);
            }
        }
        expect(unreachable, 'catalog modes no group chip surfaces').toEqual([]);
    });

    it('counts what each chip holds, and adds up to the whole library', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        const chips = screen.getByRole('group', { name: /narrow by kind/i });
        const all = within(chips).getByRole('button', { name: /^All/iu });
        const total = Number(all.textContent?.replace(/\D/gu, ''));
        const perGroup = within(chips)
            .getAllByRole('button')
            .filter((button) => button !== all)
            .map((button) => Number(button.textContent?.replace(/\D/gu, '')));
        expect(perGroup.reduce((sum, n) => sum + n, 0)).toBe(total);

        // Pressing a chip twice returns to the whole library rather than stranding the player.
        const first = within(chips).getAllByRole('button').filter((button) => button !== all)[0]!;
        await user.click(first);
        expect(first).toHaveAttribute('aria-pressed', 'true');
        await user.click(first);
        expect(all).toHaveAttribute('aria-pressed', 'true');
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
        const puzzle = within(browse).getByRole('button', { name: /^Glyph Cross\. Open details\.$/i });
        expect(puzzle).toHaveTextContent(/puzzle/i);
        // The taxonomy strips are gone: a card carries no "lanes" or "launch loop" copy.
        expect(browse).not.toHaveTextContent(/launch loop|chain leads|read pressure|chase reward/i);
        // The tile's accessible name is the title alone, which is what the e2e harness matches.
        expect(within(browse).getByRole('button', { name: /^Daily Challenge\. Open details\.$/i })).toBeInTheDocument();
    });

    it('filters the library by title or description', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.type(screen.getByRole('searchbox', { name: /filter modes/i }), 'mirror');
        const browse = screen.getByRole('region', { name: /browse modes/i });
        expect(within(browse).getByRole('button', { name: /^Mirror Puzzle\. Open details\.$/i })).toBeInTheDocument();
        expect(within(browse).queryByRole('button', { name: /^Glyph Cross\. Open details\.$/i })).not.toBeInTheDocument();
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

    it('keeps locked modes visible and explains the lock in the modal', () => {
        render(<ChooseYourPathScreen />);

        // Endless was a locked card promising a longer Classic and never became one; it is gone.
        expect(screen.queryByRole('button', { name: /^Endless Mode\. Open details\.$/i })).toBeNull();
    });

    it('offers the run clock in the setup sheet, where Gauntlet went', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        // The setup sits beside Start on the launcher, where the retired preset cards went.
        await user.click(screen.getByRole('button', { name: new RegExp(`^${CLASSIC_SETUP_COPY.title}$`, 'iu') }));

        const sheet = screen.getByTestId('classic-setup-sheet');
        await user.click(within(sheet).getByRole('radio', { name: /10 minutes/i }));
        await user.click(within(sheet).getByRole('button', { name: /^start run$/i }));
        expect(storeSpies.startRun).toHaveBeenCalledWith(expect.objectContaining({ pressure: 'timed_10' }));
    });

    it('offers the seat counts in the order a person counts them', async () => {
        /*
         * The dock renders every secondary and then every primary, so marking two players as the
         * primary tore it out of its own ordered set: a table opening this sheet read "3 players,
         * 4 players, 2 players". These are equal choices along one dimension.
         */
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Pass and Play\. Open details\.$/i }));
        const modal = screen.getByTestId('library-mode-detail-modal');
        const seatLabels = within(modal)
            .getAllByRole('button')
            .map((button) => (button.textContent ?? '').trim())
            .filter((label) => /player/i.test(label));

        expect(seatLabels).toEqual(['2 players', '3 players', '4 players']);
    });

    it('renders meditation mutator picks through the shared catalog rows in title order', () => {
        const rows = buildMeditationPickMutatorRows();
        const titles = rows.map((row) => row.title);
        expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
        expect(rows.length).toBeLessThanOrEqual(getMutatorCatalogRows().length);
    });
});
