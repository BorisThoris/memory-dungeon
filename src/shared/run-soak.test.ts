import { describe, expect, it } from 'vitest';

import { createNewRun } from './game';
import { SOAK_INVARIANTS, SOAK_PLAYERS, soakRun } from './run-soak';

const SOAK_SEEDS = Number(process.env.RUN_SOAK_SEEDS ?? 12);

/*
 * Whole runs, every action checked (`run-soak.ts`). The seed count is small for the unit suite;
 * `RUN_SOAK_SEEDS=500 yarn vitest run src/shared/run-soak.test.ts` is the long soak.
 */
describe('the run soak', () => {
    for (const [name, player] of Object.entries(SOAK_PLAYERS)) {
        it(`keeps every invariant through whole runs played ${name}`, () => {
            const reports = Array.from({ length: SOAK_SEEDS }, (_unused, index) =>
                soakRun({ seed: 7_001 + index * 104_729, player, playerName: name })
            );
            const violations = reports.flatMap((report) => report.violations);
            expect(violations, JSON.stringify(violations.slice(0, 3), null, 2)).toEqual([]);
            // And it actually played: floors cleared, stops shopped, bombs thrown.
            expect(reports.reduce((sum, report) => sum + report.floorsCleared, 0)).toBeGreaterThan(SOAK_SEEDS);
        });
    }

    it('exercises the systems it exists to watch', () => {
        const reports = Array.from({ length: SOAK_SEEDS }, (_unused, index) =>
            soakRun({ seed: 9_001 + index * 7_919, player: SOAK_PLAYERS.careful, playerName: 'careful' })
        );
        // Rules 53 reseeded the deal and strengthened holds. Keep a real Inferno/void witness
        // alongside the broad sample instead of relying on the first twelve seeds to hit it.
        reports.push(soakRun({ seed: 278_247, player: SOAK_PLAYERS.careful, playerName: 'careful' }));
        expect(reports.some((report) => report.purchases > 0), 'no run ever shopped at a stop').toBe(true);
        expect(reports.some((report) => report.bombsUsed > 0), 'no run ever threw a bomb').toBe(true);
        /* The five run-economy mechanics have no row in the floor census (the reference player never
           shops), so this is where `scripts/mechanic-accountability.ts` points for proof they happen. */
        expect(reports.some((report) => report.goldEarned > 0), 'no run ever earned gold').toBe(true);
        expect(reports.some((report) => report.missesGranted > 0), 'no run ever had a miss granted').toBe(true);
        expect(reports.some((report) => report.focusesForged > 0), 'no run ever forged an elemental focus').toBe(true);
        expect(reports.every((report) => report.essenceFound > 0), 'a cleared run found no essence').toBe(true);
        // The void: a careful player reaches Inferno, misses, and the black hole spits new pairs.
        expect(reports.some((report) => report.voidSpews > 0), 'the void never spat').toBe(true);
        // The careful player runs hot: the combo's perks change the board on some of its matches.
        expect(reports.some((report) => report.heatPerkTurns > 0), 'no run ever played a match with a heat perk on').toBe(true);
        // The Zone: the careful player reaches Inferno and ignites it; some of its pairs match.
        expect(reports.some((report) => report.zones > 0), 'no run ever ignited the Zone').toBe(true);
        expect(reports.some((report) => report.zonePairs > 0), 'no Zone ever matched a pair').toBe(true);
        // The realms: weather comes, the sway turns them, the player answers it, and doors are walked through.
        expect(reports.some((report) => report.realmWeather > 0), 'no realm ever had weather').toBe(true);
        expect(reports.some((report) => report.realmReactions > 0), 'no realm ever turned').toBe(true);
        expect(reports.some((report) => report.realmDoused > 0), 'no fire was ever doused').toBe(true);
        expect(reports.some((report) => report.realmVinesCut > 0), 'no vine was ever cut').toBe(true);
        expect(reports.some((report) => report.realmFrozen > 0), 'no card was ever frozen').toBe(true);
        expect(reports.some((report) => report.realmBacklashes > 0), 'no raging realm ever struck back').toBe(true);
        expect(reports.some((report) => report.realmTips > 0), 'the sway never tipped a floor').toBe(true);
        expect(reports.some((report) => report.elementCasts > 0), 'no matched group ever cast its element').toBe(true);
        // Alchemy: some card drank its own element, and some put an element out.
        expect(reports.some((report) => report.elementEmpowered > 0), 'no card ever drank its own element').toBe(true);
        expect(reports.some((report) => report.elementNeutralized > 0), 'no card ever put an element out').toBe(true);
        // Resonance: two elements react on a primed streak, and the stacks pass every old cap.
        expect(reports.some((report) => report.elementReactions > 0), 'no two elements ever reacted').toBe(true);
        expect(reports.some((report) => report.elementBurstPairs > 0), 'no reaction ever burst a pair off the floor').toBe(true);
        expect(reports.some((report) => report.elementResonancePeak > 5), 'no element ever stacked past five').toBe(true);
        expect(reports.some((report) => report.elementChargePeak > 1), 'no card ever held more than one charge').toBe(true);
        expect(reports.some((report) => report.realmDepthPeak > 3), 'no realm ever went deeper than the old cap of three').toBe(true);
        expect(reports.some((report) => report.realmDoors > 0), 'no door was ever walked through').toBe(true);
        expect(reports.some((report) => report.realmPeaks > 0), 'no realm ever reached its peak').toBe(true);
        expect(reports.some((report) => report.realmConfluences > 0), 'no floor was ever a confluence').toBe(true);
        expect(reports.some((report) => report.realmAttunements > 0), 'no realm was ever attuned').toBe(true);
        expect(reports.some((report) => report.realmSmokeFloors > 0), 'no floor was ever studied through smoke').toBe(true);
        // The joker left its partner stranded and the floor unclearable until a soak player used it.
        const wild = Array.from({ length: 4 }, (_unused, index) =>
            soakRun({ seed: 7_001 + index * 7_919, player: SOAK_PLAYERS.wild, playerName: 'wild', maxFloors: 3 })
        );
        expect(wild.some((report) => report.wildMatches > 0), 'no wild run ever played its joker').toBe(true);
        expect(wild.flatMap((report) => report.violations)).toEqual([]);
        expect(Object.keys(SOAK_INVARIANTS).length).toBeGreaterThanOrEqual(15);
    });

    it('resolves a pair completed by an opener instead of stopping on two face-up cards', () => {
        const report = soakRun({ seed: 78_851, player: SOAK_PLAYERS.wild, playerName: 'wild', maxFloors: 40 });
        expect(report.ended).not.toBe('resolving');
        expect(report.violations).toEqual([]);
    });

    it('catches a broken invariant rather than passing it', () => {
        // The harness is only worth anything if it can fail: feed it a run the rules say cannot exist.
        const check = SOAK_INVARIANTS['charges, gold and counters are whole numbers, never negative']!;
        const run = soakRun({ seed: 1, player: SOAK_PLAYERS.average, playerName: 'average', maxFloors: 1 });
        expect(run.violations).toEqual([]);
        const base = createNewRun(0, { runSeed: 1, gameMode: 'endless' });
        expect(check(null, base, 'study')).toBeNull();
        expect(check(null, { ...base, gold: -1 }, 'buy:peek')).not.toBeNull();
        expect(check(null, { ...base, bombCharges: 1.5 }, 'bomb')).not.toBeNull();
    });
});
