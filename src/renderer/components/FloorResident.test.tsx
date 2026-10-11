import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/game';
import { FLOOR_CURIOS } from '../../shared/floor-curio-rules';
import { greetFloorCurio } from '../../shared/floor-curio-greeting-rules';
import FloorResident from './FloorResident';

describe('visible floor residents', () => {
    it.each(FLOOR_CURIOS)('shows $name, its reply and reward after a single greeting', curio => {
        const run = { ...createNewRun(0, { runSeed: 4242 }), status: 'playing' as const, floorCurioId: curio.id, floorCurioGreeted: false };
        const onGreet = vi.fn();
        const { rerender } = render(<FloorResident onGreet={onGreet} run={run} />);
        const summary = screen.getByLabelText(`Meet ${curio.name.toLowerCase()}`);
        expect(summary).toBeVisible();
        fireEvent.click(summary);
        expect(screen.getByTestId('resident-conversation')).toBeVisible();
        expect(screen.getByText(curio.line)).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Say hello · free' }));
        expect(onGreet).toHaveBeenCalledOnce();
        rerender(<FloorResident onGreet={onGreet} run={greetFloorCurio(run)} />);
        expect(screen.getByTestId('resident-reply')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Say hello · free' })).not.toBeInTheDocument();
        fireEvent.keyDown(summary, { key: 'Escape' });
        expect(summary.closest('details')!.open).toBe(false);
        expect(summary).toHaveFocus();
    });
    it('does not promise an arrival gift on the first floor or allow greeting during study', () => {
        const run = { ...createNewRun(0), floorCurioId: 'hoarding_rat' as const, floorCurioGreeted: false };
        render(<FloorResident onGreet={vi.fn()} run={run} />);
        fireEvent.click(screen.getByLabelText('Meet a hoarding rat'));
        expect(screen.getByRole('button', { name: 'Say hello · free' })).toBeDisabled();
        expect(screen.queryByText('A peek, from a pile of them. It is keeping the rest.')).not.toBeInTheDocument();
    });
});
