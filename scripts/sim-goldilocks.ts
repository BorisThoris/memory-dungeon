/**
 * The Goldilocks probe (DGE-032's third bar): how much of a deep floor a player who forgets is sure of.
 *
 * Curiosity peaks at intermediate uncertainty (`tasks/deep-game-epic/01-research-findings.md`): a
 * board the player knows by heart is rote, one they cannot hold any of is noise. The other sims play
 * with perfect memory and a miss rate, so none of them can say where a floor sits. This one plays a
 * player with a working memory of `GOLDILOCKS_MEMORY` cards, most recently seen kept:
 *
 * - at the study window it learns that many of the cards it is shown (never the lower deck: Layers);
 * - every card it turns it remembers, pushing out the oldest;
 * - a card it knew that jumps (the restless floor's swaps, the void, the shuffles, the Warden's re-deal)
 *   is forgotten; one that slides a cell (skittish cards, the Wanderers) it watched go, and the looking
 *   glass it reasons through; a card that rises from beneath is one it has never seen;
 * - it matches a pair it knows; otherwise it turns a card it does not know, and then its partner if it
 *   knows it, or another card it does not know.
 *
 * At the start of every turn it reads the share of the floor's face-down cards it is sure of - the
 * cards still beneath count as face down and unknown - and the floor's share is the mean over its
 * turns. (The ticket said "at the study window"; with twelve cards remembered of a forty-card board
 * that reads a quarter before the first flip on every floor alike, so it is the floor as played that
 * is measured.) The bar: on every floor past 24, between `GOLDILOCKS_MIN` and `GOLDILOCKS_MAX`.
 * The plan guessed 0.3; Layers floors read 0.28-0.30 (the unseen deck is the point of them), and the
 * owner set the edge at 0.25 (2026-10-21). Two halls are exempt by design: the restless hall moves
 * the board under you on purpose (0.25-0.28), and the Warden deals its face-down cards again every
 * fifth turn (0.14) - both owner decisions, and the probe reading them as the least certain floors
 * is the design working. Thirty seeds: a floor's mean moves about 0.004 between samples.
 *
 * Floors are reached through the real floor transition (`advanceToNextLevel`), so a floor is dealt
 * with everything it would carry: Layers, the Wanderers, the Fold, the odd cards, the schedule.
 * The miss bank is held open: the probe measures certainty, not survival.
 *
 * `yarn sim:goldilocks [--from 25] [--to 60] [--seeds 12] [--check]`
 */
import { GAME_RULES_VERSION, type RunState, type Tile } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';

export const GOLDILOCKS_MEMORY = 12;
export const GOLDILOCKS_MIN = 0.25;
export const GOLDILOCKS_MAX = 0.8;
export const GOLDILOCKS_SEEDS: readonly number[] = Array.from({ length: 30 }, (_, index) => 31_337 + index * 7919);
/** The halls whose design is to unsettle what you know (`floor-mutator-schedule.ts`), measured but not held to the band. */
export const GOLDILOCKS_EXEMPT_ARCHETYPES: Readonly<Record<string, string>> = {
    restless_hall: 'the restless floor swaps face-down cards on a clock the player winds; it is meant to take back what you knew (0.25-0.28)',
    warden_hall: 'the Warden deals its face-down cards again every fifth turn; its floor is the run\u2019s designed end (0.14)',
    keeper_hall: 'the Keeper swaps its rooms every fourth turn; the act boss is designed to move what the player knew',
    cartographer_hall: 'the Cartographer turns its lower deck every third match; the act boss is designed to move what the player knew'
};
const TURN_CAP = 300;

export interface GoldilocksFloorRow {
    floor: number;
    /** Mean share of face-down cards the player was sure of, over its turns and the seeds. */
    share: number;
    /** Mean turns the floor took, and what it carried. */
    turns: number;
    layers: boolean;
    wanderers: boolean;
    fold: boolean;
    /** The floor's archetype on most seeds. */
    archetype: string | null;
}

const real = (tile: Tile): boolean => !isSingletonUtilityPairKey(tile.pairKey);

/** One floor played by a player who forgets: the mean share it was sure of at its turn starts. */
const playFloor = (start: RunState, seed: number): { share: number; turns: number } => {
    const rng = createMulberry32(hashStringToSeed(`goldilocks:${seed}:${start.board!.level}`));
    let run = start;
    // The memory, most recent last; and where each card was when last seen.
    let memory: string[] = [];
    const remember = (id: string): void => {
        memory = [...memory.filter((known) => known !== id), id].slice(-GOLDILOCKS_MEMORY);
    };
    // The study window: the cards on the board, face up, never the lower deck.
    const shown = run.board!.tiles.filter((tile) => real(tile) && tile.state === 'hidden').map((tile) => tile.id);
    for (let n = 0; n < GOLDILOCKS_MEMORY && shown.length > 0; n += 1) remember(shown.splice(pickRngIndex(rng, shown.length), 1)[0]!);
    const shares: number[] = [];
    let turns = 0;
    const cellOf = (r: RunState): Map<string, number> => new Map(r.board!.tiles.map((tile, index) => [tile.id, index]));
    const tryFlip = (r: RunState, id: string): RunState | null => {
        const next = flipTile(r, id);
        return next.board?.flippedTileIds.includes(id) ? next : null;
    };
    while (run.status === 'playing' && turns < TURN_CAP) {
        const tiles = run.board!.tiles;
        const hidden = tiles.filter((tile) => real(tile) && tile.state === 'hidden');
        const beneath = (run.board!.beneath ?? []).filter(Boolean).length;
        if (hidden.length < 2) break;
        const hiddenIds = new Set(hidden.map((tile) => tile.id));
        memory = memory.filter((id) => hiddenIds.has(id));
        shares.push(memory.length / (hidden.length + beneath));
        const known = hidden.filter((tile) => memory.includes(tile.id));
        const unknown = hidden.filter((tile) => !memory.includes(tile.id));
        const pair = known.find((tile) => known.some((other) => other.id !== tile.id && other.pairKey === tile.pairKey));
        let flipped: RunState | null = null;
        if (pair) {
            const partner = known.find((other) => other.id !== pair.id && other.pairKey === pair.pairKey)!;
            const one = tryFlip(run, pair.id);
            flipped = one ? tryFlip(one, partner.id) : null;
        }
        if (!flipped) {
            const pool = unknown.length > 0 ? unknown : hidden;
            for (let attempt = 0; attempt < pool.length && !flipped; attempt += 1) {
                const first = pool[(pickRngIndex(rng, pool.length) + attempt) % pool.length]!;
                const one = tryFlip(run, first.id);
                if (!one) continue;
                remember(first.id);
                const partner = known.find((tile) => tile.pairKey === first.pairKey && tile.id !== first.id);
                const rest = hidden.filter((tile) => tile.id !== first.id && !memory.includes(tile.id));
                const candidates = partner ? [partner] : rest.length > 0 ? rest : hidden.filter((tile) => tile.id !== first.id);
                for (let second = 0; second < candidates.length && !flipped; second += 1) {
                    const card = candidates[(pickRngIndex(rng, candidates.length) + second) % candidates.length]!;
                    const two = tryFlip(one, card.id);
                    if (two) {
                        remember(card.id);
                        flipped = two;
                    }
                }
            }
        }
        if (!flipped) break;
        const before = cellOf(flipped);
        run = resolveBoardTurn(flipped);
        turns += 1;
        if (!run.board) break;
        // A card it knew that moved is a card it no longer knows - unless it watched it go: a one-cell slide
        // (skittish cards, the Wanderers) it follows, and the looking glass it reasons through.
        const after = cellOf(run);
        const mirrored = (run.lookingGlassTurnsThisFloor ?? 0) > (flipped.lookingGlassTurnsThisFloor ?? 0);
        const columns = Math.max(1, run.board.columns);
        const oneStep = (a: number, b: number): boolean =>
            Math.abs(a - b) === columns || (Math.abs(a - b) === 1 && Math.floor(a / columns) === Math.floor(b / columns));
        memory = memory.filter((id) => {
            const [was, now] = [before.get(id), after.get(id)];
            return was === now || mirrored || (was != null && now != null && oneStep(was, now));
        });
    }
    return { share: shares.length > 0 ? shares.reduce((sum, value) => sum + value, 0) / shares.length : 0, turns };
};

export const simulateGoldilocks = ({
    from = 25,
    to = 60,
    seeds = GOLDILOCKS_SEEDS
}: { from?: number; to?: number; seeds?: readonly number[] } = {}): GoldilocksFloorRow[] => {
    const gathered = new Map<number, { shares: number[]; turns: number[]; layers: number; wanderers: number; fold: number; archetypes: string[] }>();
    for (const seed of seeds) {
        const entry = pickFloorScheduleEntry(seed, GAME_RULES_VERSION, 1, 'endless');
        const mutators = filterMutatorsByContentLock(entry.mutators);
        const board = buildBoard(1, {
            runSeed: seed,
            runRulesVersion: GAME_RULES_VERSION,
            gameMode: 'endless',
            activeMutators: mutators,
            floorTag: entry.floorTag,
            floorArchetypeId: entry.floorArchetypeId,
            featuredObjectiveId: entry.featuredObjectiveId,
            cycleFloor: entry.cycleFloor
        });
        // The bank held open: the probe measures certainty, not survival.
        let run: RunState = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, realm: null })),
            activeMutators: mutators,
            board,
            status: 'playing',
            missBank: undefined
        };
        for (let floor = 1; floor <= to; floor += 1) {
            if (floor >= from) {
                const played = playFloor(run, seed);
                const row = gathered.get(floor) ?? { shares: [], turns: [], layers: 0, wanderers: 0, fold: 0, archetypes: [] };
                row.archetypes.push(run.board!.floorArchetypeId ?? '');
                row.shares.push(played.share);
                row.turns.push(played.turns);
                if (run.board!.beneath?.some(Boolean)) row.layers += 1;
                if (run.board!.tiles.some((tile) => tile.wanderer)) row.wanderers += 1;
                if (run.board!.fold) row.fold += 1;
                gathered.set(floor, row);
            }
            const next = advanceToNextLevel({ ...run, status: 'levelComplete', missBank: undefined });
            if (!next.board || next.board.level === floor) break;
            run = { ...finishMemorizePhase(next), missBank: undefined };
        }
    }
    const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    return [...gathered.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([floor, row]) => ({
            floor,
            share: mean(row.shares),
            turns: mean(row.turns),
            layers: row.layers > row.shares.length / 2,
            wanderers: row.wanderers > row.shares.length / 2,
            fold: row.fold > row.shares.length / 2,
            archetype: (() => {
                const counts = new Map<string, number>();
                for (const id of row.archetypes) counts.set(id, (counts.get(id) ?? 0) + 1);
                const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                return top && top[0] ? top[0] : null;
            })()
        }));
};

export const judgeGoldilocks = (rows: readonly GoldilocksFloorRow[]): string[] =>
    rows.flatMap((row) =>
        row.archetype && row.archetype in GOLDILOCKS_EXEMPT_ARCHETYPES
            ? []
            : row.share < GOLDILOCKS_MIN
            ? [`floor ${row.floor} is chaos: the player is sure of ${row.share.toFixed(2)} of it, under ${GOLDILOCKS_MIN}`]
            : row.share > GOLDILOCKS_MAX
              ? [`floor ${row.floor} is rote: the player is sure of ${row.share.toFixed(2)} of it, over ${GOLDILOCKS_MAX}`]
              : []
    );

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/sim-goldilocks.ts');
if (isMain) {
    const arg = (name: string): string | undefined => {
        const index = process.argv.indexOf(`--${name}`);
        return index >= 0 ? process.argv[index + 1] : undefined;
    };
    const rows = simulateGoldilocks({
        from: Number(arg('from') ?? 25),
        to: Number(arg('to') ?? 60),
        seeds: GOLDILOCKS_SEEDS.slice(0, Number(arg('seeds') ?? GOLDILOCKS_SEEDS.length))
    });
    console.log(`memory ${GOLDILOCKS_MEMORY} cards; band ${GOLDILOCKS_MIN}-${GOLDILOCKS_MAX}`);
    console.log('floor  share  turns  carries');
    for (const row of rows) {
        const carries = [row.layers ? 'layers' : '', row.wanderers ? 'wanderers' : '', row.fold ? 'fold' : ''].filter(Boolean).join('+') || '-';
        const exempt = row.archetype && row.archetype in GOLDILOCKS_EXEMPT_ARCHETYPES ? `  (exempt: ${row.archetype})` : '';
        console.log(`${String(row.floor).padStart(5)}  ${row.share.toFixed(3)}  ${row.turns.toFixed(1).padStart(5)}  ${carries}${exempt}`);
    }
    if (process.argv.includes('--check')) {
        const issues = judgeGoldilocks(rows);
        for (const issue of issues) console.error(issue);
        if (issues.length > 0) process.exit(1);
        console.log('Goldilocks check passed');
    }
}
