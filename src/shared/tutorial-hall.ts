import type { RunState, Tile, TileSuit } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { ELEMENT_NAMES } from './element-alchemy-rules';
import { ELEMENT_REACTIONS, type ElementReactionKind } from './element-resonance-rules';
import { TILE_SUITS } from './tile-suit-rules';
import { isTileFlipBlocked } from './realm-weather-rules';

export interface TutorialStep {
    cards: readonly [string, string];
    instruction: string;
    result: string;
}
export interface TutorialLesson {
    id: string;
    title: string;
    category: 'Essentials' | 'Elements' | 'Combinations';
    elements: readonly TileSuit[];
    outcome: string;
    reaction?: ElementReactionKind;
    steps: readonly TutorialStep[];
}

const pairStep = (pair: string, suit: TileSuit, result: string): TutorialStep => ({
    cards: [`${pair}-1`, `${pair}-2`], instruction: `Match the highlighted ${ELEMENT_NAMES[suit]} pair.`, result
});
const castResults: Record<TileSuit, string> = {
    ember: 'Fire burns nearby cards and clears vines or ice.',
    tide: 'Water douses fire and moves nearby cards.',
    bone: 'Frost holds nearby cards in ice.',
    moss: 'Grove holds nearby cards in vines.'
};
const reactionResults: Record<ElementReactionKind, string> = {
    steam: 'Steam! Nearby faces are revealed.', blaze: 'Blaze! Vines burn away and you gain gold.',
    melt: 'Thaw! Ice melts and you earn bonus score.', freezeover: 'Freeze-over! The arena stays calm for a few turns.',
    flood: 'Flood! Water and Grove gain resonance.', frostbloom: 'Frostbloom! Nearby cards gain a charge.'
};

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
    { id: 'pairs', title: 'Your first pair', category: 'Essentials', elements: ['ember', 'tide'],
        outcome: 'Turn two matching cards.', steps: [pairStep('a', 'ember', 'A pair clears. Your combo starts at 1.'), pairStep('c', 'tide', 'Another pair. The combo keeps growing.')] },
    { id: 'combo', title: 'Keep the combo', category: 'Essentials', elements: ['ember', 'tide'],
        outcome: 'Matches build it. A miss breaks it.', steps: [pairStep('a', 'ember', 'Combo 1. Keep matching.'), pairStep('b', 'ember', 'Combo 2. Now try a deliberate miss.'),
            { cards: ['e-1', 'f-1'], instruction: 'Turn these two different cards.', result: 'A miss spends one chance and resets the combo.' }] },
    ...TILE_SUITS.map((suit): TutorialLesson => ({ id: `cast-${suit}`, title: `${ELEMENT_NAMES[suit]} cast`, category: 'Elements', elements: [suit],
        outcome: castResults[suit], steps: [pairStep('a', suit, castResults[suit])] })),
    ...Object.values(ELEMENT_REACTIONS).map((reaction): TutorialLesson => {
        const [first, second] = reaction.elements;
        return { id: reaction.kind, title: reaction.name, category: 'Combinations', elements: reaction.elements, reaction: reaction.kind,
            outcome: reactionResults[reaction.kind], steps: [
                pairStep('a', first, `${ELEMENT_NAMES[first]} ×1. Match that element once more.`),
                pairStep('b', first, `${ELEMENT_NAMES[first]} ×2 — primed. Switch to ${ELEMENT_NAMES[second]}.`),
                pairStep('c', second, reactionResults[reaction.kind])
            ] };
    })
];

/** Authored practice boards use the real turn engine, with no connection to the player's run/save. */
export function createTutorialRun(lesson: TutorialLesson): RunState {
    const first = lesson.elements[0]!;
    const second = lesson.elements[1] ?? TILE_SUITS.find(suit => suit !== first)!;
    const others = TILE_SUITS.filter(suit => suit !== first && suit !== second);
    const suits: Record<string, TileSuit> = { a: first, b: first, c: second, d: second, e: others[0]!, f: others[1]! };
    // Water's dousing example uses Fire cards; Grove would counter the cast.
    if (lesson.id === 'cast-tide') suits.e = 'ember';
    const halves: Record<string, number> = {};
    const tiles: Tile[] = 'a e a e b f b f c d c d'.split(' ').map(pairKey => {
        const half = halves[pairKey] = (halves[pairKey] ?? 0) + 1;
        return { id: `${pairKey}-${half}`, pairKey, suit: suits[pairKey]!, symbol: pairKey.toUpperCase(), label: pairKey.toUpperCase(), state: 'hidden',
            ...(lesson.id === 'cast-ember' && pairKey === 'e' ? { vined: true } : {}),
            ...(lesson.id === 'cast-tide' && pairKey === 'e' ? { fuse: 2 } : {}) };
    });
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 90210, gameMode: 'endless', echoFeedbackEnabled: false, realm: null }));
    return { ...base, status: 'playing', activeMutators: [], turnsThisFloor: 0, missBank: [{ floor: 4, misses: 3 }],
        realmId: 'storm', realmSeverity: 'calm', realmSecondaryId: null, elementResonance: {}, elementStreak: null,
        stats: { ...base.stats, currentStreak: 0, highestLevel: 4 },
        board: { ...base.board!, level: 4, rows: 3, columns: 4, pairCount: 6, matchedPairs: 0, flippedTileIds: [],
            cursedPairKey: null, wardPairKey: null, bountyPairKey: null, featuredObjectiveId: null, tiles } };
}

export interface TutorialSession {
    lesson: TutorialLesson;
    run: RunState;
    step: number;
    half: 0 | 1;
    phase: 'select' | 'resolve' | 'result' | 'complete';
    hint: string;
}
export const startTutorial = (lesson: TutorialLesson): TutorialSession => ({ lesson, run: createTutorialRun(lesson), step: 0, half: 0, phase: 'select', hint: '' });
export const tutorialTarget = (session: TutorialSession): string | null => session.phase === 'select' ? session.lesson.steps[session.step]?.cards[session.half] ?? null : null;

export function selectTutorialTile(session: TutorialSession, tileId: string): TutorialSession {
    if (session.phase !== 'select') return session;
    if (tileId !== tutorialTarget(session)) return { ...session, hint: 'Try the highlighted card.' };
    const tile = session.run.board?.tiles.find(candidate => candidate.id === tileId);
    if (!tile || tile.state !== 'hidden' || isTileFlipBlocked(tile)) return { ...session, hint: 'This card is held. Restart this lesson to try again.' };
    const run = flipTile(session.run, tileId);
    if (run === session.run) return session;
    return { ...session, run, half: 1, hint: '', phase: session.half === 0 ? 'select' : 'resolve' };
}
export function resolveTutorial(session: TutorialSession): TutorialSession {
    if (session.phase !== 'resolve') return session;
    return { ...session, run: resolveBoardTurn(session.run), phase: 'result' };
}
export function advanceTutorial(session: TutorialSession): TutorialSession {
    if (session.phase !== 'result') return session;
    return session.step + 1 === session.lesson.steps.length ? { ...session, phase: 'complete' }
        : { ...session, step: session.step + 1, half: 0, phase: 'select', hint: '' };
}
