import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { COSMETIC_CATALOG } from './cosmetics';
import { createNewRun, finishMemorizePhase } from './game';
import { createDefaultSaveData, normalizeSaveData } from './save-data';
import { earnedFeats, FEAT_IDS, FEATS, hasFeat, hasFeatOption, recordFeats } from './feat-unlocks';

const run = (extra: Partial<RunState> = {}): RunState => ({ ...finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' })), runRulesVersion: GAME_RULES_VERSION, ...extra });

describe('feats (DGE-024)', () => {
    it('ten feats, each unlocking a title or a title and an option, never a number', () => {
        expect(FEATS).toHaveLength(10);
        for (const feat of FEATS) {
            const kind = feat.option ? 'title_and_option' : 'title';
            expect(['title', 'title_and_option']).toContain(kind);
            expect(COSMETIC_CATALOG[feat.title].slot).toBe('title');
            expect(COSMETIC_CATALOG[feat.title].gameplayAffecting).toBe(false);
            expect(feat.condition.length).toBeGreaterThan(10);
        }
    });

    it('reads each feat off the run, and none off a fresh one', () => {
        expect(earnedFeats(run())).toEqual([]);
        expect(earnedFeats(run({ largestHeldReleaseThisRun: 12 }))).toEqual(['held_twelve']);
        expect(earnedFeats(run({ evolutions: ['lantern_of_recall'] }))).toEqual(['first_evolution']);
        expect(earnedFeats(run({ status: 'levelComplete', spiralSurvived: true }))).toEqual(['spiral_survived']);
        expect(earnedFeats(run({ masksDroppedThisFloor: 3, sleepersKeptDownThisFloor: 3, carvesSpentThisFloor: 3, reprisesThisRun: 5 })).sort()).toEqual(['five_reprises', 'sleepers_kept', 'three_carves', 'three_unmasked']);
    });

    it('keeps the feat, its title and its option on the profile, through a save round-trip', () => {
        const save = recordFeats(createDefaultSaveData(), run({ evolutions: ['lantern_of_recall'] }));
        const back = normalizeSaveData(JSON.parse(JSON.stringify(save)));
        expect(hasFeat(back, 'first_evolution')).toBe(true);
        expect(hasFeatOption(back, 'camp_evolve')).toBe(true);
        expect(back.unlocks).toContain('cosmetic:title_alchemist');
        expect(FEAT_IDS.every((id) => !hasFeat(createDefaultSaveData(), id))).toBe(true);
    });
});
