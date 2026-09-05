import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RelicId, type RunState } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import {
    createRelicOfferServiceSurfaceResult,
    createRelicPickSurfaceResult
} from './relicOfferSurfaceState';

const offeredRun = (): RunState => ({
    ...makeRun([...makePair('A', 'A')]),
    status: 'levelComplete',
    lastLevelResult: {
        clearLifeGained: 0,
        clearLifeReason: 'perfect',
        level: 3,
        livesRemaining: 3,
        mistakes: 0,
        perfect: true,
        rating: 'S',
        scoreGained: 120
    },
    shopGold: 5,
    relicOffer: {
        options: ['extra_shuffle_charge' as RelicId, 'peek_charge_plus_one' as RelicId],
        pickRound: 0,
        picksRemaining: 1,
        tier: 1
    }
});

describe('relicOfferSurfaceState', () => {
    it('ignores missing runs and relics not present in the offer', () => {
        const saveData = createDefaultSaveData();

        expect(createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run: null,
            saveData
        })).toEqual({ kind: 'ignored' });
        expect(createRelicPickSurfaceResult({
            relicId: 'guard_token_plus_one',
            run: offeredRun(),
            saveData
        })).toEqual({ kind: 'ignored' });
    });

    it('ignores corrupted offers that repeat an owned relic', () => {
        const saveData = createDefaultSaveData();
        const run = {
            ...offeredRun(),
            relicIds: ['extra_shuffle_charge' as RelicId]
        };

        expect(createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run,
            saveData
        })).toEqual({ kind: 'ignored' });
    });

    it('accepts a valid pick, clears armed board modes, and updates save stats', () => {
        const saveData = createDefaultSaveData();
        const result = createRelicPickSurfaceResult({
            relicId: 'extra_shuffle_charge',
            run: offeredRun(),
            saveData
        });

        expect(result.kind).toBe('accepted');
        if (result.kind !== 'accepted') {
            return;
        }
        expect(result.patch.run.relicIds).toContain('extra_shuffle_charge');
        expect(result.patch.run.relicOffer).toBeNull();
        expect(result.patch.run.gameplayCommandJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic.pick', relicId: 'extra_shuffle_charge' })
        ]));
        expect(result.patch.run.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic.picked', relicId: 'extra_shuffle_charge', outcome: 'advance_ready' })
        ]));
        expect(result.patch.boardPinMode).toBe(false);
        expect(result.patch.destroyPairArmed).toBe(false);
        expect(result.patch.peekModeArmed).toBe(false);
        expect(result.patch.tileSwapArmed).toBe(false);
        expect(result.patch.tileSwapFirstTileId).toBeNull();
        expect(result.patch.saveData.playerStats?.relicPickCounts?.extra_shuffle_charge).toBe(1);
        expect(result.patch.settings).toBe(result.nextSave.settings);
        expect(result.feedback).toMatchObject({
            audioCategory: 'relic-pick',
            cue: 'build.extra_shuffle_charge.claimed'
        });
    });

    it('journals one flat floor advance after the final endless relic pick', () => {
        const fixture = createPlayablePathFixture('relicDraft');
        const relicId = fixture.run!.relicOffer!.options[0]!;
        const result = createRelicPickSurfaceResult({
            relicId,
            run: {
                ...fixture.run!,
                relicOffer: { ...fixture.run!.relicOffer!, picksRemaining: 1 }
            },
            saveData: fixture.saveData
        });

        expect(result.kind).toBe('accepted');
        if (result.kind !== 'accepted') return;
        expect(result.patch.run.status).toBe('memorize');
        expect(result.patch.run.gameplayCommandJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic.pick', relicId }),
            expect.objectContaining({ type: 'floor.advance' })
        ]));
        expect(result.patch.run.gameplayCommandJournal?.map((command) => command.type)).not.toContain('floor.parasite_advance');
        expect(result.patch.run.gameplayCommandJournal?.map((command) => command.type)).not.toContain('floor.hazard_banish');
        expect(result.patch.run.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic.picked', relicId, outcome: 'advance_ready' }),
            expect.objectContaining({ type: 'floor.advanced', outcome: 'memorize' })
        ]));
    });

    it('projects migrated relic pick feedback from the typed gameplay journal', () => {
        const result = createRelicPickSurfaceResult({
            relicId: 'peek_charge_plus_one',
            run: offeredRun(),
            saveData: createDefaultSaveData()
        });

        expect(result).toMatchObject({
            kind: 'accepted',
            feedback: {
                audioCategory: 'relic-pick',
                cue: 'build.peek_relic.claimed',
                source: { kind: 'relic', id: 'peek_charge_plus_one' }
            }
        });
    });

    it('projects the Saboteur destroy relic through the same typed pick boundary', () => {
        const run = {
            ...offeredRun(),
            relicOffer: {
                ...offeredRun().relicOffer!,
                options: ['destroy_bank_plus_one' as RelicId]
            }
        };
        const result = createRelicPickSurfaceResult({
            relicId: 'destroy_bank_plus_one',
            run,
            saveData: createDefaultSaveData()
        });

        expect(result).toMatchObject({
            kind: 'accepted',
            feedback: {
                audioCategory: 'relic-pick',
                cue: 'build.breaker_chisel.claimed'
            },
            patch: { run: { destroyPairCharges: 1 } }
        });
    });

    it('projects Shrine Echo and its banked extra pick through the typed pick boundary', () => {
        const run = {
            ...offeredRun(),
            bonusRelicPicksNextOffer: 0,
            relicOffer: {
                ...offeredRun().relicOffer!,
                options: ['shrine_echo' as RelicId]
            }
        };
        const result = createRelicPickSurfaceResult({
            relicId: 'shrine_echo',
            run,
            saveData: createDefaultSaveData()
        });

        expect(result).toMatchObject({
            kind: 'accepted',
            feedback: {
                audioCategory: 'relic-pick',
                cue: 'build.shrine_echo.claimed'
            },
            patch: { run: { bonusRelicPicksNextOffer: 1 } }
        });
    });

    it('projects Slayer preparation relics through typed pick feedback', () => {
        const cases = [
            { relicId: 'chapter_compass' as RelicId, cue: 'build.chapter_compass.claimed', field: 'peekCharges' },
            { relicId: 'wager_surety' as RelicId, cue: 'build.wager_surety.claimed', field: 'guardTokens' },
            { relicId: 'parasite_ledger' as RelicId, cue: 'build.parasite_ledger.claimed', field: 'parasiteWardRemaining' }
        ];

        /**
         * The last pick of an offer advances the floor, and arriving on a floor also seats its
         * resident, whose welcome can touch the same counters. Measure each relic against a
         * control pick taken from the same run, so the delta is the relic's own contribution
         * rather than the relic plus whoever lives downstairs.
         */
        const readField = (run: RunState, field: string): number =>
            field === 'guardTokens'
                ? run.stats.guardTokens
                : run[field as 'peekCharges' | 'parasiteWardRemaining'];

        for (const row of cases) {
            const offered = offeredRun();
            const preparedRun = (options: RelicId[]): RunState => ({
                ...offered,
                gameMode: 'endless',
                runRulesVersion: GAME_RULES_VERSION,
                board: { ...offered.board!, floorArchetypeId: 'survey_hall' },
                relicOffer: { ...offered.relicOffer!, options }
            });
            const control = createRelicPickSurfaceResult({
                relicId: 'extra_shuffle_charge',
                run: preparedRun(['extra_shuffle_charge' as RelicId]),
                saveData: createDefaultSaveData()
            });
            const result = createRelicPickSurfaceResult({
                relicId: row.relicId,
                run: preparedRun([row.relicId]),
                saveData: createDefaultSaveData()
            });

            expect(result).toMatchObject({
                kind: 'accepted',
                feedback: { audioCategory: 'relic-pick', cue: row.cue }
            });
            expect(control.kind).toBe('accepted');
            expect(result.kind).toBe('accepted');
            if (control.kind !== 'accepted' || result.kind !== 'accepted') continue;
            expect(readField(result.patch.run, row.field)).toBe(readField(control.patch.run, row.field) + 1);
        }
    });

    it('projects both Memory Scout timing relics through typed pick feedback', () => {
        for (const row of [
            { relicId: 'memorize_bonus_ms' as RelicId, cue: 'build.memorize_bonus_ms.claimed' },
            {
                relicId: 'memorize_under_short_memorize' as RelicId,
                cue: 'build.memorize_under_short_memorize.claimed'
            }
        ]) {
            const offered = offeredRun();
            const result = createRelicPickSurfaceResult({
                relicId: row.relicId,
                run: {
                    ...offered,
                    relicOffer: { ...offered.relicOffer!, options: [row.relicId] }
                },
                saveData: createDefaultSaveData()
            });

            expect(result).toMatchObject({
                kind: 'accepted',
                feedback: {
                    audioCategory: 'relic-pick',
                    cue: row.cue,
                    source: { kind: 'relic', id: row.relicId }
                }
            });
        }
    });

    it('applies relic offer services only while an offer is open', () => {
        expect(createRelicOfferServiceSurfaceResult({
            run: { ...offeredRun(), relicOffer: null },
            serviceId: 'reroll_offer'
        })).toEqual({ kind: 'ignored' });

        const result = createRelicOfferServiceSurfaceResult({
            run: offeredRun(),
            serviceId: 'reroll_offer'
        });

        expect(result.kind).toBe('applied');
        if (result.kind !== 'applied') {
            return;
        }
        expect(result.patch.run.shopGold).toBe(3);
        expect(result.patch.run.relicOffer?.serviceUses?.reroll_offer).toBe(1);
        expect(result.patch.run.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'relic.offer_service_use', serviceId: 'reroll_offer' })
        ]);
        expect(result.patch.run.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic.offer_service_used', serviceId: 'reroll_offer' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'relic.offer_service.reroll_offer' })
        ]));
        expect(result.feedback).toMatchObject({ audioCategory: 'relic-service' });
    });
});
