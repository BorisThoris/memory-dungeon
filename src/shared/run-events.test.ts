import { describe, expect, it } from 'vitest';
import { copyToneAllowsPlayerFacingText } from './copy-tone';
import { createNewRun } from './game-core';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import {
    RUN_EVENT_TABLE,
    applyRunEventChoice,
    chooseRunEventOption,
    createRunEventPreviewState,
    getRunEventCatalogRows,
    getRunEventToneAuditRows,
    rollRunEventRoom
} from './run-events';

describe('REG-074 run event rooms', () => {
    it('rolls deterministic offline events with bounded choices', () => {
        const a = rollRunEventRoom({ runSeed: 74_001, rulesVersion: GAME_RULES_VERSION, floor: 5 });
        const b = rollRunEventRoom({ runSeed: 74_001, rulesVersion: GAME_RULES_VERSION, floor: 5 });

        expect(a).toEqual(b);
        expect(a.offlineOnly).toBe(true);
        expect(a.options.length).toBeGreaterThanOrEqual(2);
        expect(a.options.every((option) => option.resultText.length > 0)).toBe(true);
    });

    it('applies event choice previews without mutating the input run state', () => {
        const event = rollRunEventRoom({ runSeed: 74_002, rulesVersion: GAME_RULES_VERSION, floor: 4 });
        const choice = event.options[0]!;
        const result = chooseRunEventOption(
            { shopGold: 1, lives: 3, relicFavorProgress: 0 },
            event,
            choice.id
        );

        expect(result.applied).toBe(true);
        expect(result.eventId).toBe(event.id);
        expect(result.choiceId).toBe(choice.id);
        expect(result.next.shopGold).toBeGreaterThanOrEqual(0);
        expect(chooseRunEventOption({ shopGold: 1, lives: 3, relicFavorProgress: 0 }, event, 'missing').applied).toBe(false);
    });

    it('lists every event with conditions and bounded choice result copy', () => {
        const rows = getRunEventCatalogRows();

        expect(rows.length).toBeGreaterThanOrEqual(16);
        for (const row of rows) {
            expect(row.family).toBeTruthy();
            expect(row.roomCue.length).toBeGreaterThan(40);
            expect(row.conditionText).toMatch(/Seed-stable/);
            expect(row.choiceCount).toBe(row.choices.length);
            expect(row.choices.length).toBeGreaterThanOrEqual(2);
            expect(row.choices.some((choice) => choice.effect === 'skip')).toBe(true);
            expect(row.choices.every((choice) => choice.detail.length > 0)).toBe(true);
            expect(row.choices.every((choice) => choice.outcomeText.length > 0)).toBe(true);
        }
    });

    it('keeps expanded event identities tied to memory dungeon atmosphere', () => {
        const rows = getRunEventCatalogRows();

        expect(rows.map((row) => row.id)).toEqual(
            expect.arrayContaining([
                'palimpsest_stair',
                'moth_eaten_map',
                'oath_ledger',
                'drowned_bell',
                'paper_tide',
                'ashen_portrait',
                'soot_black_cabinet',
                'whisper_vault',
                'mnemonic_well',
                'candle_census',
                'inverted_planetarium',
                'salt_archive',
                'hourglass_orrery',
                'blank_chorus',
                'breath_index',
                'threadbare_scriptorium'
            ])
        );
        expect(rows.map((row) => row.title)).toEqual(
            expect.arrayContaining([
                'Palimpsest stair',
                'Moth-eaten map',
                'Oath ledger',
                'Drowned bell',
                'Paper tide',
                'Ashen portrait',
                'Soot-black cabinet',
                'Whisper vault',
                'Mnemonic well',
                'Candle census',
                'Inverted planetarium',
                'Salt archive',
                'Hourglass orrery',
                'Blank chorus',
                'Breath index',
                'Threadbare scriptorium'
            ])
        );
    });

    it('keeps the event room catalog broad enough for repeat route variety', () => {
        const rows = getRunEventCatalogRows();
        const allEffects = new Set(rows.flatMap((row) => row.choices.map((choice) => choice.effect)));
        const allFamilies = new Set(rows.map((row) => row.family));

        expect(rows.length).toBeGreaterThanOrEqual(24);
        expect(allFamilies.size).toBeGreaterThanOrEqual(9);
        expect([...allFamilies]).toEqual(
            expect.arrayContaining([
                'archive_record',
                'echo_bargain',
                'key_memory',
                'route_palimpsest',
                'sunken_chamber',
                'keeper_relic',
                'celestial_archive'
            ])
        );
        expect(allEffects).toEqual(
            new Set([
                'gain_shop_gold',
                'gain_relic_favor',
                'heal_or_guard',
                'gain_iron_key',
                'gain_destroy_charge',
                'gain_score',
                'skip'
            ])
        );
    });

    it('uses atmospheric result text when an event choice defines it', () => {
        const event = RUN_EVENT_TABLE.find((candidate) => candidate.id === 'drowned_bell')!;
        const choice = event.choices.find((option) => option.id === 'raise_bell')!;

        expect(choice.resultText).toBe('The bell rises silent, heavy enough to break a false pair.');
        expect(choice.resultText).not.toBe(choice.detail);
    });

    it('publishes atmospheric outcome text through event catalog rows', () => {
        const bell = getRunEventCatalogRows().find((event) => event.id === 'drowned_bell')!;
        const raiseBell = bell.choices.find((choice) => choice.id === 'raise_bell')!;

        expect(raiseBell.detail).toBe('+1 destroy charge to the uncapped run bank.');
        expect(raiseBell.outcomeText).toBe('The bell rises silent, heavy enough to break a false pair.');
        expect(raiseBell.outcomeText).not.toBe(raiseBell.detail);
    });

    it('keeps newer event outcomes tied to route memory and keeper atmosphere', () => {
        const paper = RUN_EVENT_TABLE.find((event) => event.id === 'paper_tide')!;
        const portrait = RUN_EVENT_TABLE.find((event) => event.id === 'ashen_portrait')!;

        expect(paper.body).toContain('copied routes');
        expect(paper.choices.find((choice) => choice.id === 'bind_pages')?.resultText).toContain('remembered key');
        expect(portrait.body).toContain('forgotten keeper');
        expect(portrait.choices.find((choice) => choice.id === 'study_face')?.resultText).toContain('fixes in memory');
    });

    it('audits every event room for memory-dungeon anchors and authored outcomes', () => {
        const rows = getRunEventToneAuditRows();

        expect(rows).toHaveLength(RUN_EVENT_TABLE.length);
        expect(rows.every((row) => row.toneReady)).toBe(true);
        expect(rows.find((row) => row.id === 'sealed_keyring')?.memoryAnchors).toEqual(
            expect.arrayContaining(['key', 'route'])
        );
        expect(rows.find((row) => row.id === 'ashen_portrait')?.memoryAnchors).toEqual(
            expect.arrayContaining(['keeper', 'memory'])
        );
        expect(rows.find((row) => row.id === 'mnemonic_well')?.memoryAnchors).toEqual(
            expect.arrayContaining(['mnemonic', 'well'])
        );
        expect(rows.find((row) => row.id === 'whisper_vault')?.memoryAnchors).toEqual(
            expect.arrayContaining(['route', 'shrine', 'vault'])
        );
        expect(rows.find((row) => row.id === 'patrol_diary')).toEqual(
            expect.objectContaining({
                family: 'patrol_record',
                roomCue: expect.stringContaining('enemy movement')
            })
        );
        expect(rows.find((row) => row.id === 'candle_census')).toEqual(
            expect.objectContaining({
                family: 'archive_record',
                roomCue: expect.stringContaining('darkness')
            })
        );
        expect(rows.find((row) => row.id === 'inverted_planetarium')).toEqual(
            expect.objectContaining({
                family: 'celestial_archive',
                roomCue: expect.stringContaining('star map')
            })
        );
        expect(rows.find((row) => row.id === 'hourglass_orrery')?.memoryAnchors).toEqual(
            expect.arrayContaining(['glass'])
        );
        expect(rows.find((row) => row.id === 'breath_index')?.memoryAnchors).toEqual(
            expect.arrayContaining(['index', 'room'])
        );
        expect(rows.find((row) => row.id === 'threadbare_scriptorium')?.memoryAnchors).toEqual(
            expect.arrayContaining(['key', 'memory', 'route'])
        );
    });

    it('gives every event choice atmospheric resolution feedback', () => {
        for (const choice of RUN_EVENT_TABLE.flatMap((event) => event.choices)) {
            expect(choice.resultText).toBeTruthy();
            expect(choice.resultText).not.toBe(choice.detail);
        }
    });

    it('keeps event room copy clear of real-money and online-rank language', () => {
        for (const event of RUN_EVENT_TABLE) {
            expect(copyToneAllowsPlayerFacingText(event.title)).toBe(true);
            expect(copyToneAllowsPlayerFacingText(event.body)).toBe(true);
            for (const choice of event.choices) {
                expect(copyToneAllowsPlayerFacingText(choice.label)).toBe(true);
                expect(copyToneAllowsPlayerFacingText(choice.detail)).toBe(true);
                expect(copyToneAllowsPlayerFacingText(choice.resultText ?? '')).toBe(true);
            }
        }
    });

    it('keeps decline choices safe and local', () => {
        const event = rollRunEventRoom({ runSeed: 74_004, rulesVersion: GAME_RULES_VERSION, floor: 7 });
        const decline = event.options.find((option) => option.effect === 'skip')!;
        const state = { shopGold: 2, lives: 4, relicFavorProgress: 1 };
        const result = chooseRunEventOption(state, event, decline.id);

        expect(result.applied).toBe(true);
        expect(result.next).toEqual(state);
    });

    it('grants event destroy charges into the uncapped run bank', () => {
        const event = Array.from({ length: 20 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 1, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_destroy_charge'))!;
        const choice = event.options.find((option) => option.effect === 'gain_destroy_charge')!;
        const result = chooseRunEventOption({ shopGold: 0, lives: 3, relicFavorProgress: 0, destroyPairCharges: 7 }, event, choice.id);

        expect(result.applied).toBe(true);
        expect(result.next.destroyPairCharges).toBe(8);
    });

    it('previews key and score event rewards with the same visible counters as the claim path', () => {
        const keyEvent = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_201, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_iron_key'))!;
        const scoreEvent = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_202, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_score'))!;

        const keyChoice = keyEvent.options.find((option) => option.effect === 'gain_iron_key')!;
        const scoreChoice = scoreEvent.options.find((option) => option.effect === 'gain_score')!;

        expect(
            chooseRunEventOption(
                { shopGold: 0, lives: 4, relicFavorProgress: 0, ironKeys: 1 },
                keyEvent,
                keyChoice.id
            ).next.ironKeys
        ).toBe(2);
        expect(
            chooseRunEventOption(
                { shopGold: 0, lives: 4, relicFavorProgress: 0, totalScore: 40, currentLevelScore: 10, bestScore: 50 },
                scoreEvent,
                scoreChoice.id
            ).next
        ).toMatchObject({
            totalScore: 65,
            currentLevelScore: 35,
            bestScore: 65
        });
    });

    it('normalizes malformed counters before applying score event rewards', () => {
        const event = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_205, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_score'))!;
        const choice = event.options.find((option) => option.effect === 'gain_score')!;
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                totalScore: Number.NaN,
                currentLevelScore: -12.5,
                bestScore: Number.POSITIVE_INFINITY
            }
        };

        const result = applyRunEventChoice(run, event, choice.id);

        expect(result.applied).toBe(true);
        expect(result.run.stats.totalScore).toBe(25);
        expect(result.run.stats.currentLevelScore).toBe(25);
        expect(result.run.stats.bestScore).toBe(25);
    });

    it('normalizes malformed counters before applying economy event rewards', () => {
        const goldEvent = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_206, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_shop_gold'))!;
        const favorEvent = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_207, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_relic_favor'))!;
        const goldChoice = goldEvent.options.find((option) => option.effect === 'gain_shop_gold')!;
        const favorChoice = favorEvent.options.find((option) => option.effect === 'gain_relic_favor')!;

        const goldResult = applyRunEventChoice({ ...createNewRun(0), shopGold: Number.NaN }, goldEvent, goldChoice.id);
        const favorResult = applyRunEventChoice(
            {
                ...createNewRun(0),
                relicFavorProgress: Number.POSITIVE_INFINITY,
                bonusRelicPicksNextOffer: -2,
                favorBonusRelicPicksNextOffer: Number.NaN
            },
            favorEvent,
            favorChoice.id
        );

        expect(goldResult.run.shopGold).toBe(2);
        expect(favorResult.run.relicFavorProgress).toBe(1);
        expect(favorResult.run.bonusRelicPicksNextOffer).toBe(0);
        expect(favorResult.run.favorBonusRelicPicksNextOffer).toBe(0);
    });

    it('builds event preview state from the active run counters before resolving a choice', () => {
        const run = {
            ...createNewRun(0),
            shopGold: 3,
            lives: 5,
            relicFavorProgress: 2,
            bonusRelicPicksNextOffer: 1,
            favorBonusRelicPicksNextOffer: 1,
            dungeonKeys: { iron: 1, treasure: 1 },
            destroyPairCharges: 4,
            stats: {
                ...createNewRun(0).stats,
                totalScore: 75,
                currentLevelScore: 25,
                bestScore: 100,
                guardTokens: 1
            }
        };
        const event = Array.from({ length: 40 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_203, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_relic_favor'))!;
        const choice = event.options.find((option) => option.effect === 'gain_relic_favor')!;

        const result = chooseRunEventOption(createRunEventPreviewState(run), event, choice.id);

        expect(result.next).toMatchObject({
            shopGold: 3,
            lives: 5,
            ironKeys: 2,
            totalScore: 75,
            currentLevelScore: 25,
            bestScore: 100,
            destroyPairCharges: 4,
            guardTokens: 1,
            relicFavorProgress: 0,
            bonusRelicPicksNextOffer: 2,
            favorBonusRelicPicksNextOffer: 2
        });
    });

    it('normalizes malformed key records before event previews', () => {
        const run = {
            ...createNewRun(0),
            dungeonKeys: Number.NaN as unknown as RunState['dungeonKeys']
        };

        expect(createRunEventPreviewState(run).ironKeys).toBe(0);
    });

    it('previews full-life recovery as guard instead of hiding the promised fallback', () => {
        const event = Array.from({ length: 20 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 2, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'heal_or_guard'))!;
        const choice = event.options.find((option) => option.effect === 'heal_or_guard')!;
        const result = chooseRunEventOption(
            { shopGold: 0, lives: 5, relicFavorProgress: 0, guardTokens: 1 },
            event,
            choice.id
        );

        expect(result.applied).toBe(true);
        expect(result.next.lives).toBe(5);
        expect(result.next.guardTokens).toBe(2);
    });

    it('rejects stale event choices after a run has reached zero health', () => {
        const event = Array.from({ length: 20 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 74_204, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'heal_or_guard'))!;
        const choice = event.options.find((option) => option.effect === 'heal_or_guard')!;
        const deadPreview = { shopGold: 2, lives: 0, relicFavorProgress: 1, guardTokens: 0 };
        const deadRun = {
            ...createNewRun(0),
            status: 'gameOver' as const,
            lives: 0,
            shopGold: 2,
            stats: {
                ...createNewRun(0).stats,
                guardTokens: 0
            }
        };

        expect(chooseRunEventOption(deadPreview, event, choice.id)).toEqual({
            applied: false,
            eventId: event.id,
            choiceId: choice.id,
            next: deadPreview,
            reason: 'invalid_state'
        });
        expect(applyRunEventChoice(deadRun, event, choice.id)).toEqual({
            run: deadRun,
            applied: false,
            reason: 'invalid_state'
        });
    });
});
