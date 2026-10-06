import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game';
import { ElementCastGuide } from './ElementCastGuide';
import ElementResonanceStrip from './ElementResonanceStrip';
import { advanceTutorial, resolveTutorial, selectTutorialTile, startTutorial, TUTORIAL_LESSONS } from '../../shared/tutorial-hall';

describe('element decision guide', () => {
    it('separates ground chemistry from amplified chemistry using real results', () => {
        let session = startTutorial(TUTORIAL_LESSONS.find(lesson => lesson.id === 'steam')!);
        for (const step of session.lesson.steps) {
            for (const id of step.cards) session = selectTutorialTile(session, id);
            session = advanceTutorial(resolveTutorial(session));
        }
        render(<ElementCastGuide run={session.run} />);
        expect(screen.getByTestId('reaction-result-ground')).toHaveTextContent('Ground · Steam ×1');
        expect(screen.getByTestId('reaction-result-ground')).toHaveTextContent('1 revealed');
        expect(screen.getByTestId('reaction-result-streak')).toHaveTextContent('Amplified · Steam ×2');
        expect(screen.getByTestId('reaction-result-streak')).toHaveTextContent('2 revealed');
    });
    it('previews actual reaction power and consequences from the primed streak', () => {
        const run = { ...createNewRun(0), elementStreak: { suit: 'ember' as const, links: 3 }, elementResonance: { ember: 6 }, realmAttunement: { storm: 4 } };
        render(<ElementCastGuide run={run} />);
        expect(screen.getByTestId('element-next-tide')).toHaveTextContent('Steam ×6');
        expect(screen.getByTestId('element-next-tide')).toHaveTextContent('reveal up to 6 faces');
        expect(screen.getByTestId('element-next-moss')).toHaveTextContent('+3 gold');
        expect(screen.getByTestId('element-next-bone')).toHaveTextContent('+900 score');
        expect(screen.queryByTestId('element-next-ember')).not.toBeInTheDocument();
    });

    it('does not promise a charged reaction before two consecutive matches', () => {
        const run = { ...createNewRun(0), elementStreak: { suit: 'ember' as const, links: 1 } };
        render(<ElementCastGuide run={run} />);
        expect(screen.queryByTestId('element-next-tide')).not.toBeInTheDocument();
        expect(screen.getByText(/Same element twice/)).toHaveTextContent('A miss breaks the streak.');
    });

    it('retains the real last-match receipt, including a failed or resisted cast', () => {
        const run = createNewRun(0);
        run.board!.elementCast = { key: 'receipt', suit: 'ember', sourceCells: [0, 1], contacts: [], power: 2, multiplier: 1, groupPairs: 1,
            reaction: 'Steam', detail: '3 counter-cards resisted · Fire + Water ground → Steam: reveal up to 1 face' };
        render(<ElementCastGuide run={run} />);
        expect(screen.getByTestId('element-cast-receipt')).toHaveTextContent('Last match · Fire + Steam');
        expect(screen.getByTestId('element-cast-receipt')).toHaveTextContent('3 counter-cards resisted');
    });
});

describe('the elemental cast guide', () => {
    it('keeps cast power and arena effects concise before the first match', () => {
        const run = createNewRun(0, { realm: { realmId: 'tide', severity: 'calm' } });
        render(<ElementResonanceStrip run={run} />);
        expect(screen.getByRole('button', { name: 'How elemental matches work' })).toBeInTheDocument();
        const guide = screen.getByTestId('element-cast-rules');
        expect(guide).toHaveTextContent('Every pair casts');
        expect(guide).toHaveTextContent('2+ cards · +0 reach');
        expect(guide).toHaveTextContent('Wet ground');
        expect(guide).not.toHaveTextContent('Holds cover at least two complete pairs');
        expect(guide).toHaveAttribute('popover', 'auto');
    });

    it('shows combo and resonance scaling and both halves of a confluence', () => {
        const run = createNewRun(0);
        render(<ElementCastGuide run={{ ...run, stats: { ...run.stats, currentStreak: 6 }, elementResonance: { moss: 6 }, realmId: 'grove', realmSecondaryId: 'storm' }} />);
        const guide = screen.getByTestId('element-cast-rules');
        expect(guide).toHaveTextContent('6+ cards · +4 reach');
        expect(guide).toHaveTextContent('Rooted ground');
        expect(guide).toHaveTextContent('Every cast reveals a nearby card');
    });
});
