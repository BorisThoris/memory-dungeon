import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChooseYourPathScreen from './ChooseYourPathScreen';

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

describe('Optional play options', () => {
    beforeEach(() => { Object.values(storeSpies).forEach(spy => spy.mockClear()); });
    it('starts regular solo play without setup', async () => {
        const user=userEvent.setup(); render(<ChooseYourPathScreen/>);
        expect(screen.queryByRole('region',{name:/choose your path/i})).toBeNull();
        await user.click(screen.getByRole('button',{name:'Play now'}));
        expect(storeSpies.startRun).toHaveBeenCalledWith();
    });
    it('starts the custom run described by its controls', async () => {
        const user=userEvent.setup(); render(<ChooseYourPathScreen/>);
        await user.click(screen.getByText('Customize a solo run'));
        await user.click(screen.getByRole('checkbox',{name:'More time to study the cards'}));
        await user.click(screen.getByRole('checkbox',{name:'No shuffles'}));
        await user.click(screen.getByRole('button',{name:'Play now'}));
        expect(storeSpies.startRun).toHaveBeenCalledWith(expect.objectContaining({pacing:'calm',vows:['scholar']}));
    });
    it('starts the requested shared table directly', async () => {
        const user=userEvent.setup(); render(<ChooseYourPathScreen/>);
        await user.click(screen.getByText('Play together on this device'));
        await user.click(screen.getByRole('button',{name:'4 players'}));
        expect(storeSpies.startPassAndPlayRun).toHaveBeenCalledWith(4);
    });
    it('accepts a shared message and rejects malformed keys', async () => {
        const user=userEvent.setup(); render(<ChooseYourPathScreen/>);
        await user.click(screen.getByText('Use a shared run key'));
        const form=screen.getByTestId('choose-path-shared-run');const input=within(form).getByRole('textbox');
        await user.type(input,'not a key');await user.click(within(form).getByRole('button'));
        expect(screen.getByRole('alert')).toBeInTheDocument();expect(storeSpies.startSharedRun).not.toHaveBeenCalled();
        await user.clear(input);await user.type(input,'Same run: md1:wild:33:912');await user.click(within(form).getByRole('button'));
        expect(storeSpies.startSharedRun).toHaveBeenCalledWith('Same run: md1:wild:33:912');
    });
});
