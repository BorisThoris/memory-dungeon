import type { BoardState, DungeonBossId, DungeonRunNodeKind, EnemyHazardKind, EnemyHazardPattern, RunShopItemId } from './contracts';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { runArray } from './run-array-guards';

export const DUNGEON_BOSS_DEFEAT_SCORE = 70;

export type DungeonBossLifecycleSource = 'boss_card_pair' | 'moving_patrol' | 'none';
export type DungeonBossPhase = 'unseen' | 'opening' | 'bloodied' | 'defeated';

export interface DungeonBossRewardHook {
    score: number;
    shopGold: number;
    guardTokens: number;
    comboShards: number;
    relicFavor: number;
    enemiesDefeated: number;
    treasuresOpened: number;
}

export interface DungeonBossDefinition {
    id: DungeonBossId;
    label: string;
    symbol: string;
    hp: number;
    hazardKind: EnemyHazardKind;
    hazardPattern: EnemyHazardPattern;
    signatureModifier: string;
    rewardHook: string;
    cardCopy: string;
    visualAudioPlaceholders: string[];
    reward: DungeonBossRewardHook;
}

export interface DungeonBossPressureRule {
    bossId: DungeonBossId;
    memorizeMsDelta: number;
    mismatchTriesDelta: number;
    shopPriorityItemId: RunShopItemId;
    pressureCopy: string;
}

export const DUNGEON_BOSS_DEFINITIONS: Record<DungeonBossId, DungeonBossDefinition> = {
    trap_warden: {
        id: 'trap_warden',
        label: 'Latch Warden',
        symbol: 'W',
        hp: 3,
        hazardKind: 'warden',
        hazardPattern: 'guard',
        signatureModifier: 'Guard pattern prioritizes traps, locks, keys, levers, and reward-adjacent pressure.',
        rewardHook: 'Defeat breaks the latch for guard, score, and Favor.',
        cardCopy: 'Defeat the Latch Warden for score, guard, and Favor.',
        visualAudioPlaceholders: ['trap chain tell', 'warding shield hit flash', 'boss defeat lockbreak stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 0,
            guardTokens: 1,
            comboShards: 0,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    },
    rush_sentinel: {
        id: 'rush_sentinel',
        label: 'Bell-Rush Sentinel',
        symbol: 'S',
        hp: 3,
        hazardKind: 'sentinel',
        hazardPattern: 'patrol',
        signatureModifier: 'Patrol pattern rotates pressure across active non-utility cards.',
        rewardHook: 'Defeat stills the bell for a combo shard, bonus score, and Favor.',
        cardCopy: 'Defeat the Bell-Rush Sentinel for score, a combo shard, and Favor.',
        visualAudioPlaceholders: ['rush windup tell', 'dash lane afterimage', 'combo shard defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE + 10,
            shopGold: 0,
            guardTokens: 0,
            comboShards: 1,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    },
    treasure_keeper: {
        id: 'treasure_keeper',
        label: 'Gilded Keeper',
        symbol: 'K',
        hp: 3,
        hazardKind: 'warden',
        hazardPattern: 'guard',
        signatureModifier: 'Guard pattern favors treasure, key, lever, and lock cards.',
        rewardHook: 'Defeat opens the ledger for shop gold, treasure progress, score, and Favor.',
        cardCopy: 'Defeat the Gilded Keeper for score, shop gold, and Favor.',
        visualAudioPlaceholders: ['coin guard tell', 'cache glint hit flash', 'treasure spill defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 4,
            guardTokens: 0,
            comboShards: 0,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 1
        }
    },
    spire_observer: {
        id: 'spire_observer',
        label: 'Mnemonist Observer',
        symbol: 'O',
        hp: 3,
        hazardKind: 'observer',
        hazardPattern: 'observe',
        signatureModifier: 'Observe pattern prioritizes boss, enemy, and trap encounter cards.',
        rewardHook: 'Defeat closes the gaze for extra Favor and score.',
        cardCopy: 'Defeat the Mnemonist Observer for extra Favor.',
        visualAudioPlaceholders: ['spire gaze tell', 'observation pulse hit flash', 'favor chime defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 0,
            guardTokens: 0,
            comboShards: 0,
            relicFavor: 2,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    }
};

export const getDungeonBossDefinition = (bossId: DungeonBossId | null | undefined): DungeonBossDefinition | null =>
    bossId ? DUNGEON_BOSS_DEFINITIONS[bossId] : null;

export const DUNGEON_BOSS_PRESSURE_RULES: Record<DungeonBossId, DungeonBossPressureRule> = {
    trap_warden: {
        bossId: 'trap_warden',
        memorizeMsDelta: 140,
        mismatchTriesDelta: 0,
        shopPriorityItemId: 'destroy_charge',
        pressureCopy: 'Trap Warden pressure extends study time but rewards bringing trap control.'
    },
    rush_sentinel: {
        bossId: 'rush_sentinel',
        memorizeMsDelta: -120,
        mismatchTriesDelta: 0,
        shopPriorityItemId: 'region_shuffle_charge',
        pressureCopy: 'Rush Sentinel shortens study time; board movement is the clean counterplay.'
    },
    treasure_keeper: {
        bossId: 'treasure_keeper',
        memorizeMsDelta: 0,
        mismatchTriesDelta: 0,
        shopPriorityItemId: 'iron_key',
        pressureCopy: 'Gilded Keeper pressures locks and treasure routing; keys are favored before the fight.'
    },
    spire_observer: {
        bossId: 'spire_observer',
        memorizeMsDelta: 80,
        mismatchTriesDelta: 1,
        shopPriorityItemId: 'peek_charge',
        pressureCopy: 'Mnemonist Observer gives a longer study, then punishes mismatches with extra recall pressure.'
    }
};

export const getDungeonBossPressureRule = (
    bossId: DungeonBossId | null | undefined
): DungeonBossPressureRule | null => (bossId ? DUNGEON_BOSS_PRESSURE_RULES[bossId] ?? null : null);

const dungeonBossEnemyHazards = (
    board: { enemyHazards?: readonly { bossId?: DungeonBossId | null; state?: string | null }[] } | null | undefined
): readonly { bossId?: DungeonBossId | null; state?: string | null }[] =>
    runArray(board?.enemyHazards);

export const getActiveDungeonBossPressureRule = (
    board:
        | BoardState
        | { dungeonBossId?: DungeonBossId | null; floorTag?: string | null; enemyHazards?: readonly { bossId?: DungeonBossId | null; state?: string | null }[] }
        | null
        | undefined
): DungeonBossPressureRule | null => {
    const activeHazardBossId =
        board && 'tiles' in board
            ? activeEnemyHazardsForBoard(board).find((hazard) => hazard.bossId != null)?.bossId
            : dungeonBossEnemyHazards(board).find((hazard) => hazard.bossId != null && hazard.state !== 'defeated')?.bossId;
    const bossId =
        board?.dungeonBossId ??
        activeHazardBossId ??
        null;
    return getDungeonBossPressureRule(bossId);
};

export interface DungeonEliteEncounterRules {
    nodeKind: 'elite';
    label: string;
    objectiveId: 'pacify_floor';
    threatBudgetFloor: number;
    rewardBudgetFloor: number;
    movingPatrolFloor: number;
    ruleHook: string;
    rewardHook: string;
    completionCopy: string;
    scoreRule: string;
}

export const DUNGEON_ELITE_ENCOUNTER_RULES: DungeonEliteEncounterRules = {
    nodeKind: 'elite',
    label: 'Mnemonic Sentinel',
    objectiveId: 'pacify_floor',
    threatBudgetFloor: 2,
    rewardBudgetFloor: 1,
    movingPatrolFloor: 1,
    ruleHook: 'Elite nodes force rush-recall pressure with at least one named enemy pair and a moving patrol.',
    rewardHook: 'Elite boards add a small reward budget and route elite anchors without boss score or boss Favor rules.',
    completionCopy: 'Elite pacified. Claim the hard-route memory reward without applying boss-floor scoring.',
    scoreRule: 'Uses normal floor scoring; no boss multiplier.'
};

export const getDungeonEliteEncounterRules = (
    nodeKind: DungeonRunNodeKind | null | undefined
): DungeonEliteEncounterRules | null => (nodeKind === 'elite' ? DUNGEON_ELITE_ENCOUNTER_RULES : null);
