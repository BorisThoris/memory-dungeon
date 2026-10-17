import { describe, expect, it } from 'vitest';
import { createDepartureSheet, DEPARTURE_SHEET_MAX_STEPS_PER_FRAME } from './cardDepartureSheet';
import { DEPARTURE_PHYSICS_STEP } from './cardDeparturePhysics';

const grid = (columns: number, rows: number): Float32Array => {
    const out: number[] = [];
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) out.push(x / columns - 0.5, y / rows - 0.5, 0);
    return new Float32Array(out);
};

describe('the departing card sheet', () => {
    it('moves the same at 30 fps as at 120 fps', () => {
        const at30 = createDepartureSheet(grid(4, 6), 4, 6, 'water', 3);
        const at120 = createDepartureSheet(grid(4, 6), 4, 6, 'water', 3);
        for (let t = 1 / 30; t <= 1 + 1e-9; t += 1 / 30) at30.advance(t, -5);
        for (let t = 1 / 120; t <= 1 + 1e-9; t += 1 / 120) at120.advance(t, -5);
        for (let i = 0; i < at30.positions.length; i += 1) expect(at30.positions[i]).toBeCloseTo(at120.positions[i]!, 5);
    });

    it('takes no more than its cap of steps in one long frame', () => {
        const capped = createDepartureSheet(grid(4, 6), 4, 6, 'water', 3);
        const stepped = createDepartureSheet(grid(4, 6), 4, 6, 'water', 3);
        capped.advance(1, -5);
        const capAge = DEPARTURE_SHEET_MAX_STEPS_PER_FRAME * DEPARTURE_PHYSICS_STEP;
        for (let t = DEPARTURE_PHYSICS_STEP; t <= capAge + 1e-9; t += DEPARTURE_PHYSICS_STEP) stepped.advance(t, -5);
        for (let i = 0; i < capped.positions.length; i += 1) expect(capped.positions[i]).toBeCloseTo(stepped.positions[i]!, 6);
    });
});
