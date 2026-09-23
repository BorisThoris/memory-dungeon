import { CLASSIC_SETUP_COPY } from '../copy/screenCopy';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMutatorCatalogRows } from '../../shared/game-catalog';
import { RUN_MODE_CATALOG } from '../../shared/run-mode-catalog';

import ChooseYourPathScreen from './ChooseYourPathScreen';
import { buildMeditationPickMutatorRows } from './chooseYourPathScreenModel';

const storeSpies = vi.hoisted(() => ({
    startRun: vi.fn(),
    startSharedRun: vi.fn(),
    startPassAndPlayRun: vi.fn()
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
        startPassAndPlayRun: storeSpies.startPassAndPlayRun,
        startPinVowRun: vi.fn(),
        startPracticeRun: vi.fn(),
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


    it('shows every alternate mode directly without filters for a one-item library', () => {
        render(<ChooseYourPathScreen />);
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /narrow by kind/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('choose-path-mode-count')).not.toBeInTheDocument();
        const browse = screen.getByRole('region', { name: /browse modes/i });
        for (const mode of RUN_MODE_CATALOG.filter((entry) => entry.id !== 'classic')) {
            expect(within(browse).getByRole('button', { name: `${mode.title}. Open details.` })).toBeInTheDocument();
        }
        expect(screen.getByTestId('choose-path-first-run-beats')).toHaveTextContent('Clean → Sharp → Fever');
        expect(screen.queryByText(/Safe, Greed, or Mystery/i)).not.toBeInTheDocument();
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






    it('states each browse mode once: group, title, one description, locked tag where it applies', () => {
        render(<ChooseYourPathScreen />);

        const browse = screen.getByRole('region', { name: /browse modes/i });
        const table = within(browse).getByRole('button', { name: /^Pass and Play\. Open details\.$/i });
        // Its own tag, not the one group every mode is in since the collapse.
        expect(table).toHaveTextContent(/same device/i);
        expect(table).not.toHaveTextContent(/core modes/i);
        // The taxonomy strips are gone: a card carries no "lanes" or "launch loop" copy.
        expect(browse).not.toHaveTextContent(/launch loop|chain leads|read pressure|chase reward/i);
    });


    it('opens a mode in the detail modal and plays it from there', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /^Pass and Play\. Open details\.$/i }));
        const modal = screen.getByTestId('library-mode-detail-modal');
        expect(within(modal).getByText(/one device/i)).toBeInTheDocument();
        await user.click(within(modal).getByRole('button', { name: /^2 players$/i }));
        expect(storeSpies.startPassAndPlayRun).toHaveBeenCalledWith(2);
    });

    it('keeps locked modes visible and explains the lock in the modal', () => {
        render(<ChooseYourPathScreen />);

        // Endless was a locked card promising a longer Classic and never became one; it is gone.
        expect(screen.queryByRole('button', { name: /^Endless Mode\. Open details\.$/i })).toBeNull();
    });

    it('starts the run the setup sheet describes, with no clock on offer', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        // The setup sits beside Start on the launcher, where the retired preset cards went.
        await user.click(screen.getByRole('button', { name: new RegExp(`^${CLASSIC_SETUP_COPY.title}$`, 'iu') }));

        const sheet = screen.getByTestId('classic-setup-sheet');
        // The clock left with the timer: the sheet asks about vows, pacing and chaos, never minutes.
        expect(within(sheet).queryByRole('radio')).toBeNull();
        expect(within(sheet).queryByText(/minutes|clock/i)).toBeNull();
        await user.click(within(sheet).getByRole('checkbox', { name: new RegExp(CLASSIC_SETUP_COPY.calmLabel, 'iu') }));
        await user.click(within(sheet).getByRole('button', { name: /^start run$/i }));
        expect(storeSpies.startRun).toHaveBeenCalledWith(expect.objectContaining({ pacing: 'calm' }));
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
