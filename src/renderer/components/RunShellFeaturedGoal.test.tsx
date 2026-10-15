import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { advanceToNextLevel } from '../../shared/next-floor-transition-rules';
import { TILE_SUIT_CATALOG } from '../../shared/tile-suit-rules';
import RunShell from './RunShell';

vi.mock('../audio/gameSfx', () => ({ playStudyClosingTickSfx: vi.fn() }));
vi.mock('../input/touchHaptics', () => ({ tapStudyClosing: vi.fn(() => true) }));

/** Floor 5 of the schedule features the amplified reaction, floor 7 the calm one. */
const floor = (level: number) => {
    const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 1 });
    return finishMemorizePhase(advanceToNextLevel({ ...base, status: 'levelComplete', board: { ...base.board!, level: level - 1 } }));
};
const calmFloor = () => floor(7);
const hues = () => [...screen.getByTestId('featured-floor-goal').querySelectorAll<HTMLElement>('span[style]')]
    .map((span) => [span.textContent, span.style.getPropertyValue('--goal-hue')]);

describe('the featured floor goal', () => {
    it('names its recipe in the colours of its elements, as the board\'s chips do', () => {
        const run = calmFloor();
        expect(run.board?.featuredObjectiveId).toBe('calm_reaction');
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} shellLayout="desktop" tools={[]} />);
        const goal = screen.getByTestId('featured-floor-goal');
        expect(goal).toHaveTextContent('Water → Water → Ice');
        expect(hues()).toEqual([
            ['Water', TILE_SUIT_CATALOG.tide.hue],
            ['Water', TILE_SUIT_CATALOG.tide.hue],
            ['Ice', TILE_SUIT_CATALOG.bone.hue]
        ]);
    });

    it('names the recipe the amplified floor always deals, while saying any reaction will do', () => {
        const run = floor(5);
        expect(run.board?.featuredObjectiveId).toBe('amplified_reaction');
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} shellLayout="desktop" tools={[]} />);
        expect(screen.getByTestId('featured-floor-goal')).toHaveTextContent('Two of one element → another, as Fire → Fire → Water');
        expect(hues()).toEqual([
            ['Fire', TILE_SUIT_CATALOG.ember.hue],
            ['Fire', TILE_SUIT_CATALOG.ember.hue],
            ['Water', TILE_SUIT_CATALOG.tide.hue]
        ]);
    });
});
