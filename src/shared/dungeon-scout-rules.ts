import type { BoardState, FindableKind, RunState, Tile } from './contracts';
import {
    createMulberry32,
    hashStringToSeed,
    shuffleWithRng
} from './rng';

export type ScoutRevealSource = 'lantern_ward' | 'omen_seal';
type ScoutTargetKind = 'dungeon' | 'route' | 'hazard';

const tileIsUnresolved = (tile: Tile): boolean => tile.state !== 'matched' && tile.state !== 'removed';

const tileAlreadyScouted = (tile: Tile): boolean => tile.scoutRevealSource != null || tile.lanternScouted === true;

const chooseScoutPairKey = (
    board: BoardState,
    run: RunState,
    source: ScoutRevealSource
): { pairKey: string; kind: ScoutTargetKind } | null => {
    const dungeonKeys = [
        ...new Set(
            board.tiles
                .filter(
                    (tile) =>
                        (tile.dungeonCardKind === 'trap' || tile.dungeonCardKind === 'enemy') &&
                        tile.dungeonCardState === 'hidden' &&
                        !tileAlreadyScouted(tile) &&
                        tileIsUnresolved(tile)
                )
                .map((tile) => tile.pairKey)
        )
    ];
    const routeKeys = [
        ...new Set(
            board.tiles
                .filter(
                    (tile) =>
                        (tile.routeSpecialKind === 'mystery_veil' ||
                            tile.routeSpecialKind === 'secret_door' ||
                            tile.routeSpecialKind === 'omen_seal' ||
                            tile.routeSpecialKind === 'mimic_cache' ||
                            tile.routeSpecialKind === 'loaded_gateway' ||
                            tile.routeSpecialKind === 'parasite_vessel') &&
                        tile.routeSpecialRevealed !== true &&
                        tileIsUnresolved(tile)
                )
                .map((tile) => tile.pairKey)
        )
    ];
    const hazardKeys = [
        ...new Set(
            board.tiles
                .filter((tile) => tile.tileHazardKind != null && !tileAlreadyScouted(tile) && tileIsUnresolved(tile))
                .map((tile) => tile.pairKey)
        )
    ];
    const pick = (keys: readonly string[]): string | null => {
        if (keys.length === 0) {
            return null;
        }
        const rng = createMulberry32(
            hashStringToSeed(
                `${source}Scout:${run.runRulesVersion}:${run.runSeed}:${board.level}:${
                    source === 'lantern_ward' ? run.lanternWardScoutsThisFloor : run.omenSealScoutsThisFloor
                }`
            )
        );
        return shuffleWithRng(() => rng(), [...keys].sort())[0] ?? null;
    };
    const priority: readonly ScoutTargetKind[] =
        source === 'omen_seal' ? ['hazard', 'dungeon', 'route'] : ['dungeon', 'route', 'hazard'];
    for (const kind of priority) {
        const key = pick(kind === 'dungeon' ? dungeonKeys : kind === 'route' ? routeKeys : hazardKeys);
        if (key) return { pairKey: key, kind };
    }
    return null;
};

const applyScoutReveal = (
    board: BoardState,
    run: RunState,
    source: ScoutRevealSource
): { board: BoardState; scouted: boolean } => {
    const target = chooseScoutPairKey(board, run, source);
    if (!target) {
        return { board, scouted: false };
    }
    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) => {
                if (tile.pairKey !== target.pairKey) {
                    return tile;
                }
                if (target.kind === 'dungeon' && (tile.dungeonCardKind === 'trap' || tile.dungeonCardKind === 'enemy')) {
                    return {
                        ...tile,
                        dungeonCardState: 'revealed' as const,
                        lanternScouted: source === 'lantern_ward' ? true : tile.lanternScouted,
                        scoutRevealSource: source
                    };
                }
                if (target.kind === 'route') {
                    return { ...tile, routeSpecialRevealed: true, routeSpecialRevealSource: source };
                }
                if (target.kind === 'hazard' && tile.tileHazardKind != null) {
                    return {
                        ...tile,
                        lanternScouted: source === 'lantern_ward' ? true : tile.lanternScouted,
                        scoutRevealSource: source
                    };
                }
                return tile;
            })
        },
        scouted: true
    };
};

export const applyLanternWardScout = (board: BoardState, run: RunState): { board: BoardState; scouted: boolean } =>
    applyScoutReveal(board, run, 'lantern_ward');

export const applyOmenSealScout = (board: BoardState, run: RunState): { board: BoardState; scouted: boolean } =>
    applyScoutReveal(board, run, 'omen_seal');

export const applyFindableScoutGlint = (
    board: BoardState,
    run: RunState,
    claimedKind: FindableKind | null
): { board: BoardState; scouted: boolean } =>
    claimedKind === 'scout_glint' ? applyScoutReveal(board, run, 'omen_seal') : { board, scouted: false };
