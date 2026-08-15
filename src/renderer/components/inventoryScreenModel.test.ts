import { describe, expect, it } from 'vitest';
import type { RelicId, RewardPerkId } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import { createNewRun } from '../../shared/game-core';
import {
    createInventoryQuantityMap,
    createInventoryScreenModel,
    getActiveTraitBuildRows,
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

    it('normalizes charge and token quantities through the run inventory model', () => {
        const run = {
            ...createNewRun(0),
            shuffleCharges: -2,
            destroyPairCharges: -1,
            peekCharges: -4,
            stats: { ...createNewRun(0).stats, guardTokens: -2, comboShards: -5 }
        };

        const quantityById = createInventoryQuantityMap(run);

        expect(quantityById.get('shuffle_charge')).toBe(0);
        expect(quantityById.get('destroy_charge')).toBe(0);
        expect(quantityById.get('peek_charge')).toBe(0);
        expect(quantityById.get('guard_token')).toBe(0);
        expect(quantityById.get('combo_shard')).toBe(0);
    });

    it('dedupes trait build rows from loadout and drafted relics', () => {
        const run = {
            ...createNewRun(0, { startingLoadoutId: 'route_tactician' }),
            relicIds: ['chapter_compass', 'region_shuffle_free_first'] as RelicId[]
        };

        const ids = getActiveTraitBuildRows(run).map((row) => row.id);

        expect(ids).toContain('drift_routing');
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('creates the inventory screen model without reaching into renderer store state', () => {
        const run = {
            ...createNewRun(0),
            relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one'] as RelicId[]
        };
        const model = createInventoryScreenModel(run, createDefaultSaveData());

        expect(model.buildProfile.summary).toContain('The Conduit Cartographer');
        expect(model.inventoryRows.length).toBeGreaterThan(0);
        expect(model.equippedCosmetic?.id).toBe('title_seeker');
    });

    it('adds tactical action cues to inventory rows without changing the shared row contract', () => {
        const run = {
            ...createNewRun(0),
            dungeonKeys: { iron: 1, treasure: 0, shrine: 0, boss: 0, trap: 0 },
            shuffleCharges: 1
        };
        const model = createInventoryScreenModel(run, createDefaultSaveData());

        expect(model.inventoryRows.find((row) => row.id === 'shuffle_charge')?.actionCue).toMatchObject({
            label: 'Route reset',
            tone: 'route'
        });
        expect(model.inventoryRows.find((row) => row.id === 'iron_key')?.actionCue).toMatchObject({
            label: 'Open route',
            tone: 'key'
        });
        expect(model.inventoryRows.find((row) => row.id === 'destroy_charge')?.actionCue).toMatchObject({
            label: 'Restock first',
            detail: 'No charges currently banked.',
            tone: 'chain'
        });
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
            rewardPerkIds: ['echo_conduit_double'] as RewardPerkId[],
            stats: { ...createNewRun(0).stats, currentStreak: 3, comboShards: 2, guardTokens: 0 },
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2
        };

        expect(getInventoryPayoffEngineSignal(run)).toMatchObject({
            label: 'Super stack',
            value: '5 payoffs live',
            detail: 'Chain + Pickup + Burst + Trait route',
            nextCue: 'Push x6 reward',
            tone: 'super'
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
                comboShards: Number.POSITIVE_INFINITY,
                currentStreak: Number.NaN,
                guardTokens: Number.NEGATIVE_INFINITY
            },
            traitRouteObjectiveProgressThisFloor: Number.NaN,
            traitRouteObjectiveRequiredThisFloor: Number.POSITIVE_INFINITY
        };

        const signals = getInventoryRunLoopSignals(run);

        expect(signals).toMatchObject([
            { id: 'chain', value: 'ready' },
            { id: 'pickup', value: '0' },
            { id: 'resource', nextCue: 'Build x6 chain pressure', value: '0 shards / 0 guards' },
            { id: 'trait', value: 'scout' }
        ]);
        expect(signals.map((signal) => `${signal.value} ${signal.nextCue}`).join(' ')).not.toMatch(/NaN|Infinity/);
        expect(getInventoryPayoffEngineSignal(run, signals)).toMatchObject({
            label: 'Prime payoff',
            value: 'Prime beat',
            tone: 'setup'
        });
    });

    it('uses shared trait route action cues in run loop signals', () => {
        const [traitSignal] = getInventoryRunLoopSignals({
            ...createNewRun(0),
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            traitRouteObjectiveRewardTextThisFloor: null
        }).filter((signal) => signal.id === 'trait');

        expect(traitSignal).toMatchObject({
            detail: 'One route to cashout: +1 combo shard.',
            nextCue: 'Cash next route',
            value: '1/2'
        });
    });

    it('keeps quiet runs framed as setup instead of fake payoff', () => {
        const signal = getInventoryPayoffEngineSignal({
            ...createNewRun(0),
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 0,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveProgressThisFloor: 0,
            traitRouteObjectiveRequiredThisFloor: 0,
            traitRouteObjectiveRewardClaimedThisFloor: false
        });

        expect(signal).toMatchObject({
            label: 'Prime payoff',
            value: 'Prime beat',
            detail: 'Open with a safe match to light chain, pickup, or trait payoffs.',
            nextCue: 'Start x3 loop',
            tone: 'setup'
        });
    });
});
