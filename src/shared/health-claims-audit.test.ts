import { describe, expect, it } from 'vitest';
import {
    DESIGN_VOCABULARY,
    findHealthClaims,
    HEALTH_CLAIM_PATTERNS,
    maskDesignVocabulary,
    stripComments
} from '../../scripts/health-claims';

/**
 * The rule this gate exists for, held open on the sentences that made it a rule.
 *
 * The FTC's 2016 complaint against Lumosity is the reference case for this genre, and the phrases
 * below are the shape of what it fined: performance sharpened, age-related cognitive decline
 * staved off, dementia and Alzheimer's protected against. A gate that bans a word nobody writes is
 * theatre; these are the sentences a memory game actually gets written about it, so these are what
 * it has to catch.
 */
const CLAIMS_THAT_MUST_FAIL: readonly string[] = [
    "export const TAGLINE = 'Brain training for your memory.';",
    "export const BLURB = 'A daily memory workout.';",
    "const copy = 'Play every day and improve your memory.';",
    "const copy = 'Sharpen your recall in ten minutes a day.';",
    "const copy = 'Keeps your brain sharp as you age.';",
    "const copy = 'Measurable cognitive improvement after four weeks.';",
    "const copy = 'May help protect against dementia.';",
    "const copy = 'Built on neuroplasticity research.';",
    "const copy = 'Clinically proven to boost focus.';",
    "const copy = 'Raise your IQ one floor at a time.';",
    "const copy = 'Brain Age for the desktop.';",
    "const copy = 'Mental fitness, one board at a time.';"
];

/** What the game may still say, because it describes the product rather than promising an outcome. */
const COPY_THAT_MUST_PASS: readonly string[] = [
    "export const TAGLINE = 'A memory game where the board fights back.';",
    "const copy = 'Remember where the pair was. Clear the floor before the turns run out.';",
    "const note = 'Cognitive load: the HUD shows three numbers, never more.';",
    "const note = 'Cognitive accessibility: every cue has a second channel.';",
    "const job = 'Recall is the cognitive job this power does.';",
    "const copy = 'Your best run is stored on this machine and nowhere else.';"
];

describe('no shipped string promises a cognitive or medical benefit', () => {
    it('catches every claim the FTC case is about', () => {
        for (const line of CLAIMS_THAT_MUST_FAIL) {
            const found = findHealthClaims(['fixture.ts'], () => line);
            expect(found.length, `not caught: ${line}`).toBeGreaterThan(0);
        }
    });

    it('lets the game describe itself, and lets the design vocabulary through', () => {
        for (const line of COPY_THAT_MUST_PASS) {
            const found = findHealthClaims(['fixture.ts'], () => line);
            expect(found.map((entry) => entry.claim), `wrongly caught: ${line}`).toEqual([]);
        }
    });

    it('reads a comment about the rule as the record of it, not a breach', () => {
        const source = '// Never say brain training. See the FTC Lumosity settlement.\nexport const OK = 1;\n';
        expect(findHealthClaims(['fixture.ts'], () => source)).toEqual([]);
        expect(stripComments(source)).not.toContain('brain training');
    });

    it('allows a phrase rather than a word, so the ban cannot be exempted away', () => {
        // "cognitive" is not banned; promising a cognitive benefit is. Masking the design phrases
        // before matching is what keeps those two apart without a per-file exemption list.
        expect(maskDesignVocabulary('cognitive load is fine')).not.toContain('cognitive');
        expect(maskDesignVocabulary('cognitive improvement is not')).toContain('cognitive');
    });

    it('names every claim shape it bans, so the list can be argued with', () => {
        expect(HEALTH_CLAIM_PATTERNS.length).toBeGreaterThanOrEqual(11);
        for (const { id, pattern } of HEALTH_CLAIM_PATTERNS) {
            expect(id.length, id).toBeGreaterThan(2);
            expect(pattern.flags, id).toContain('i');
        }
        for (const [phrase, reason] of Object.entries(DESIGN_VOCABULARY)) {
            expect(reason.endsWith('.'), phrase).toBe(true);
            expect(reason.length, phrase).toBeGreaterThan(40);
        }
    });
});
