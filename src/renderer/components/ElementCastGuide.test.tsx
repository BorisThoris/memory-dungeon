import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game';
import { ElementCastGuide } from './ElementCastGuide';
import ElementResonanceStrip from './ElementResonanceStrip';

describe('the elemental cast guide', () => {
    it('explains guaranteed casts, current power, arena and immunity before the first match', () => {
        const run = createNewRun(0, { realm: { realmId: 'tide', severity: 'calm' } });
        render(<ElementResonanceStrip run={run} />);
        expect(screen.getByRole('button', { name: 'How elemental matches work' })).toBeInTheDocument();
        const guide = screen.getByTestId('element-cast-rules');
        expect(guide).toHaveTextContent('Every pair casts');
        expect(guide).toHaveTextContent('2 targets · +0 reach');
        expect(guide).toHaveTextContent('The arena is wet');
        expect(guide).toHaveTextContent('Arena holds leave another pair free');
        expect(guide).toHaveTextContent('Ordinary casts keep cards playable');
        expect(guide).toHaveAttribute('popover', 'auto');
    });

    it('shows combo and resonance scaling and both halves of a confluence', () => {
        const run = createNewRun(0);
        render(<ElementCastGuide run={{ ...run, stats: { ...run.stats, currentStreak: 6 }, elementResonance: { moss: 6 }, realmId: 'grove', realmSecondaryId: 'storm' }} />);
        const guide = screen.getByTestId('element-cast-rules');
        expect(guide).toHaveTextContent('6 targets · +4 reach');
        expect(guide).toHaveTextContent('The arena is fertile');
        expect(guide).toHaveTextContent('The arena conducts every cast');
    });
});
