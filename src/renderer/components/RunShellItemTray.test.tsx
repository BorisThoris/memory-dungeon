import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import RunShell, { type RunShellTool } from './RunShell';

vi.mock('../audio/gameSfx', () => ({ playStudyClosingTickSfx: vi.fn() }));
vi.mock('../input/touchHaptics', () => ({ tapStudyClosing: vi.fn(() => true) }));

const run = () => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 90_210 }));
const tool = (id: string, extra: Partial<RunShellTool> = {}): RunShellTool => ({ id, label: id, glyph: <svg />, onClick: vi.fn(), ...extra });

describe('RunShell item tray (phone)', () => {
    it('folds the tools into Items and Pause on a phone', () => {
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run()} shellLayout="phone-portrait" tools={[tool('peek'), tool('bomb')]} />);
        expect(screen.queryByTestId('tool-peek')).not.toBeInTheDocument();
        expect(screen.getByTestId('tool-tray-toggle')).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('game-toolbar-main-menu')).toBeInTheDocument();
    });

    it('opens the bag, runs the chosen tool, and closes it again', async () => {
        const peek = tool('peek');
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run()} shellLayout="phone-portrait" tools={[peek, tool('bomb')]} />);
        await userEvent.click(screen.getByTestId('tool-tray-toggle'));
        expect(screen.getByTestId('tool-tray-toggle')).toHaveAttribute('aria-expanded', 'true');
        await userEvent.click(screen.getByTestId('tool-peek'));
        expect(peek.onClick).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('tool-tray')).not.toBeInTheDocument();
    });

    it('names an armed tool on the Items button so it can be found and cancelled', () => {
        render(
            <RunShell
                onPause={vi.fn()}
                personalBestDepth={false}
                run={run()}
                shellLayout="phone-portrait"
                tools={[tool('peek', { armed: true, name: 'Pick a card to peek' })]}
            />
        );
        expect(screen.getByTestId('tool-tray-toggle')).toHaveAccessibleName(/pick a card to peek is armed/i);
    });

    it('stands Fit on the bar once there is a pinch to undo, and keeps it in the bag until then', () => {
        const { rerender } = render(
            <RunShell onPause={vi.fn()} personalBestDepth={false} run={run()} shellLayout="phone-portrait" tools={[tool('peek'), tool('fit', { disabled: true })]} />
        );
        expect(screen.queryByTestId('tool-fit')).not.toBeInTheDocument();
        rerender(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run()} shellLayout="phone-portrait" tools={[tool('peek'), tool('fit')]} />);
        expect(screen.getByTestId('tool-fit')).toBeInTheDocument();
        expect(screen.queryByTestId('tool-tray')).not.toBeInTheDocument();
    });

    it('keeps every tool on the dock on a desktop', () => {
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run()} shellLayout="desktop" tools={[tool('peek')]} />);
        expect(screen.getByTestId('tool-peek')).toBeInTheDocument();
        expect(screen.queryByTestId('tool-tray-toggle')).not.toBeInTheDocument();
    });
});
