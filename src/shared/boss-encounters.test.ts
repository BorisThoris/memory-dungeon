import { describe, expect, it } from 'vitest';
import {
    getBossEncounterIdentityForFloor,
    getEncounterIdentityForFloor,
    getFloorIdentityContract,
    paletteMechanicLine
} from './boss-encounters';
import { buildBoard } from './board-generation';
import {
    FLOOR_ARCHETYPE_IDS,
    GAME_RULES_VERSION,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId
} from './contracts';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import {
    SCATTERED_SUIT_CEILING,
    boardPaletteWidth,
    getSuitDealProfile,
    suitCountForDeal
} from './tile-suit-rules';

describe('REG-076 boss and elite encounter identity', () => {
    it('derives boss identity from scheduled boss floor tags', () => {
        const entry = pickFloorScheduleEntry(76_001, GAME_RULES_VERSION, 7, 'endless');
        const identity = getEncounterIdentityForFloor(entry);
        const floorIdentity = getBossEncounterIdentityForFloor(entry.floorTag, entry)!;

        expect(identity).not.toBeNull();
        expect(identity).toMatchObject({
            encounterRank: 'boss',
            label: 'Boss encounter',
            scoreRule: 'Applies the boss floor score multiplier after bonuses.'
        });
        expect(identity!.mechanics.length).toBeGreaterThanOrEqual(2);
        expect(identity!.mechanics.join(' ')).toContain('Keystone Warden');
        /*
         * Gen 213: this asserted the mechanics list contains a "Keystone Pair" board anchor - a
         * thing that has never existed in the game, which the module's own comment said so plainly
         * that Gen 201 cut it from the constant and left it in the builder. The test was what kept
         * the builder honest to the phantom instead of to the game. A boss floor's board change is
         * the scattered deal; that is what the list has to carry, and the anchor is what it must
         * not.
         */
        // Gen 261: the line is derived from the archetype's deal rather than asserting "scattered",
        // because the boss tag can carry a clumped archetype. It still has to name a suit deal.
        expect(identity!.mechanics).toEqual(expect.arrayContaining([expect.stringMatching(/-suit deal:/)]));
        expect(identity!.mechanics.join(' ')).not.toContain('Keystone Pair');
        expect(identity!.placeholderNeeded).toBe(true);
        expect(identity!.placeholderSlots).toContain('boss intro stinger');
        expect(floorIdentity.payoffCopy).toContain('Offline-safe fallback art and audio');
        expect(floorIdentity.payoffCopy).not.toMatch(/placeholder/i);
    });


    it('keeps normal/breather floors out of boss encounter presentation', () => {
        const entry = pickFloorScheduleEntry(76_001, GAME_RULES_VERSION, 1, 'endless');

        expect(getEncounterIdentityForFloor(entry)).toBeNull();
    });

    it('provides floor identity contracts for baseline, trap, recovery, treasure, skittish, and boss floors', () => {
        const rows = [
            getFloorIdentityContract({
                floorTag: 'normal',
                floorArchetypeId: 'survey_hall',
                mutators: [],
                featuredObjectiveLabel: 'Flip par'
            }),
            getFloorIdentityContract({
                floorTag: 'boss',
                floorArchetypeId: 'trap_hall',
                mutators: ['sticky_fingers'],
                featuredObjectiveLabel: 'Scholar style'
            }),
            getFloorIdentityContract({
                floorTag: 'breather',
                floorArchetypeId: 'breather',
                mutators: [],
                featuredObjectiveLabel: 'Scholar style'
            }),
            getFloorIdentityContract({
                floorTag: 'breather',
                floorArchetypeId: 'treasure_gallery',
                mutators: ['findables_floor'],
                featuredObjectiveLabel: 'Scholar style'
            }),
            getFloorIdentityContract({
                floorTag: 'normal',
                floorArchetypeId: 'skittish_hall',
                mutators: ['skittish_cards'],
                featuredObjectiveLabel: 'Scholar style'
            })
        ];

        expect(rows.map((row) => row.id)).toEqual([
            'baseline_floor',
            'boss_trophy_moment',
            'recovery_study_room',
            'pickup_gallery_dense',
            // Gen 263: floor 11 used to borrow the anchor floor's copy; it has its own now.
            'skittish_cards'
        ]);
        expect(rows[1]).toMatchObject({
            label: 'Keystone chamber',
            activeReminder: 'Keystone: three suits, a chain that is easy to keep.'
        });
        /*
         * Gen 201: these sentences are read in a run, so they have to describe the run. The whole
         * table used to teach traps, disarms, keys, locks, guard, the parasite clock and finding
         * the exit - every one of them removed with the dungeon layer. The check below is the one
         * that would have caught it: no floor may coach a noun the game does not have.
         */
        const removedNouns = /\b(trap|disarm|key|keys|lock|locked|guard|parasite|exit|cache|relic|gold|shop|life|lives|destroy|stray|favor)\b/i;
        /*
         * Over EVERY floor the schedule can produce, not the five sampled above: eleven archetypes
         * times three tags, plus the null-archetype fallback, each with and without a mutator that
         * changes the branch taken. The five-row sample is what let the old table rot in the first
         * place - four of its seven branches were never looked at.
         */
        const everyFloor = FLOOR_ARCHETYPE_IDS.flatMap((floorArchetypeId) =>
            (['normal', 'breather', 'boss'] as const).flatMap((floorTag) =>
                [[], ['findables_floor'], ['short_memorize']].map((mutators) =>
                    getFloorIdentityContract({
                        floorTag,
                        floorArchetypeId,
                        mutators: mutators as MutatorId[],
                        featuredObjectiveLabel: null
                    })
                )
            )
        ).concat(
            getFloorIdentityContract({ floorTag: 'normal', floorArchetypeId: null, mutators: [], featuredObjectiveLabel: null })
        );
        // Twelve archetypes since the lantern hall (Gen 263): 12 x 3 tags x 3 mutator sets, plus the fallback.
        expect(everyFloor.length).toBe(109);
        for (const row of [...rows, ...everyFloor]) {
            for (const sentence of [row.teachingSentence, row.counterplaySentence, row.floorClearSentence, row.activeReminder]) {
                expect(sentence, `${row.id} coaches a removed system: ${sentence}`).not.toMatch(removedNouns);
            }
            expect(row.teachingSentence.length).toBeGreaterThan(20);
            expect(row.counterplaySentence.length).toBeGreaterThan(20);
            expect(row.activeReminder.length).toBeGreaterThan(10);
        }
        for (const row of rows) {
            expect(row.teachingSentence.length).toBeGreaterThan(20);
            expect(row.counterplaySentence.length).toBeGreaterThan(20);
            expect(row.floorClearSentence.length).toBeGreaterThan(20);
            expect(row.atmosphericFeedback.length).toBeGreaterThan(20);
            expect(row.atmosphericFeedback).not.toBe(row.floorClearSentence);
            expect(row.activeReminder.length).toBeGreaterThan(10);
            expect(row.tokens.length).toBeGreaterThan(0);
        }
    });
});

/**
 * Gen 261, from the refinement-ledger walk. Three separate strings on a boss floor asserted a
 * palette, and each was wrong for at least one archetype the boss tag can carry: the keystone floor
 * told every player "two suits, long chains" while the position-nine rotation also tags
 * `treasure_gallery` boss, which deals four. The clear line and the boss mechanics list were wrong a
 * second way, calling a scattered deal "many small pops rather than one big one" when scattered means
 * `SCATTERED_SUIT_CEILING` - two suits, the widest reach a pop gets.
 */
describe('what a floor tells the player about its palette', () => {
    const paletteOnBoard = (floorArchetypeId: FloorArchetypeId, floorTag: FloorTag): number =>
        boardPaletteWidth(
            buildBoard(21, {
                runSeed: 61_001,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless',
                activeMutators: [],
                floorTag,
                floorArchetypeId,
                featuredObjectiveId: null,
                cycleFloor: 21
            })
        );

    /** The suit count a sentence claims: "two suits" or "4 suits". */
    const claimedSuits = (text: string): number | null => {
        if (/\btwo[- ]suit/i.test(text)) return 2;
        const digits = /\b(\d+)[- ]suits?\b/i.exec(text);
        return digits ? Number(digits[1]) : null;
    };

    it('never names a palette the board does not deal, on any archetype or tag', () => {
        for (const floorArchetypeId of FLOOR_ARCHETYPE_IDS) {
            for (const floorTag of ['normal', 'breather', 'boss'] as FloorTag[]) {
                const dealt = paletteOnBoard(floorArchetypeId, floorTag);
                const contract = getFloorIdentityContract({ floorArchetypeId, floorTag, mutators: [] });
                const sentences = [
                    contract.teachingSentence,
                    contract.counterplaySentence,
                    contract.floorClearSentence,
                    contract.activeReminder,
                    paletteMechanicLine(floorArchetypeId)
                ];
                for (const sentence of sentences) {
                    const claimed = claimedSuits(sentence);
                    if (claimed === null) continue;
                    expect(claimed, `${floorArchetypeId}/${floorTag} says "${sentence}" on a ${dealt}-suit board`).toBe(
                        dealt
                    );
                }
            }
        }
    });

    it('says a narrow palette is a chain that is easier to keep, and never that it widens the pop', () => {
        /*
         * The physics half, as it stands since 2026-09-23. Gen 259 measured a two-suit board at 0.74
         * of a four-suit board's turns per pair, because every match touched its own kind and the
         * pop reached far. The break is capped by rung now, so the palette no longer changes what a
         * pop takes (re-measured: two suits and four within 0.02 turns a pair); what three suits
         * still buys is a card of your kind close by, which is a chain that is easier to keep.
         */
        for (const floorArchetypeId of FLOOR_ARCHETYPE_IDS) {
            const narrow = suitCountForDeal(getSuitDealProfile(floorArchetypeId)) <= SCATTERED_SUIT_CEILING;
            const line = paletteMechanicLine(floorArchetypeId);
            expect(/easier to keep|never far/i.test(line), `${floorArchetypeId}: "${line}"`).toBe(narrow);
            expect(/more map|whatever the palette/i.test(line), `${floorArchetypeId}: "${line}"`).toBe(!narrow);
            expect(/widest|wide pops|two suits/i.test(line), `${floorArchetypeId}: "${line}"`).toBe(false);
        }
    });

    it('reads at least one floor each way, so neither branch is untested', () => {
        const widths = FLOOR_ARCHETYPE_IDS.map((id) => suitCountForDeal(getSuitDealProfile(id)));
        expect(widths.some((width) => width <= SCATTERED_SUIT_CEILING)).toBe(true);
        expect(widths.some((width) => width > SCATTERED_SUIT_CEILING)).toBe(true);
    });
});
