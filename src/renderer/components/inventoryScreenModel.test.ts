import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { createNewRun } from '../../shared/game-core';
import {
    createInventoryScreenModel,
    getInventoryPayoffEngineSignal,
    getInventoryRunLoopSignals,
    getInventoryToolActionCue,
    modeTitle
} from './inventoryScreenModel';

describe('inventoryScreenModel', () => {
    it('resolves known game mode titles and falls back to the raw id', () => {
        expect(modeTitle('endless')).toBe('Classic Run');
        expect(modeTitle('custom_lab')).toBe('custom_lab');
    });



    it('creates the inventory screen model without reaching into renderer store state', () => {
        const model = createInventoryScreenModel(createNewRun(0), createDefaultSaveData());

        expect(model.inventoryRows.length).toBeGreaterThan(0);
        expect(model.equippedCosmetic?.id).toBe('title_seeker');
    });


    it('keeps the inventory tool action cue helper deterministic for unavailable rows', () => {
        const row = createInventoryScreenModel(createNewRun(0), createDefaultSaveData()).inventoryRows.find(
            (candidate) => candidate.id === 'peek_charge'
        );
        const unavailableRow = row
            ? {
                  ...row,
                  available: false,
                  quantity: 0,
                  quantityLabel: '0',
                  unavailableReason: 'No charges currently banked.'
              }
            : null;

        expect(row).toBeDefined();
        expect(unavailableRow ? getInventoryToolActionCue(unavailableRow) : null).toMatchObject({
            label: 'Restock first',
            detail: 'No charges currently banked.',
            tone: 'chain'
        });
    });

    it('summarizes live payoff lanes into a reusable engine signal', () => {
        const run = {
            ...createNewRun(0),
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1,
            stats: { ...createNewRun(0).stats, currentStreak: 3 }
        };

        expect(getInventoryPayoffEngineSignal(run)).toMatchObject({
            label: 'Payoff engine',
            value: '2 payoffs live',
            detail: 'Chain + Pickup',
            nextCue: 'Push x6 reward',
            tone: 'burst'
        });
    });

    it('normalizes malformed run loop counters before building inventory payoff copy', () => {
        const run = {
            ...createNewRun(0),
            findablesClaimedThisFloor: Number.NaN,
            findablesTotalThisFloor: Number.POSITIVE_INFINITY,
            stats: {
                ...createNewRun(0).stats,
                bestStreak: Number.NaN,
                currentStreak: Number.NaN
            }
        };

        const signals = getInventoryRunLoopSignals(run);

        expect(signals).toMatchObject([
            { id: 'chain', value: 'ready' },
            { id: 'pickup', value: '0' }
        ]);
        expect(signals.map((signal) => `${signal.value} ${signal.nextCue}`).join(' ')).not.toMatch(/NaN|Infinity/);
        expect(getInventoryPayoffEngineSignal(run, signals)).toMatchObject({
            label: 'Prime payoff',
            value: 'Prime beat',
            tone: 'setup'
        });
    });

    it('keeps quiet runs framed as setup instead of fake payoff', () => {
        const signal = getInventoryPayoffEngineSignal({
            ...createNewRun(0),
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 0
        });

        expect(signal).toMatchObject({
            label: 'Prime payoff',
            value: 'Prime beat',
            detail: 'Open with a safe match to light chain or pickup payoffs.',
            nextCue: 'Start x3 loop',
            tone: 'setup'
        });
    });
});
