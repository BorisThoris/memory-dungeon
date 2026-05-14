import {
    FINDABLE_KIND_SPAWN_WEIGHTS,
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_MATCH_SAFE_HAZARD_WARDS,
    FINDABLE_MATCH_SCOUT_REVEALS,
    FINDABLE_MATCH_SCORE,
    type FindableKind
} from './contracts';

export interface FindableRewardRow {
    kind: FindableKind;
    label: string;
    marker: string;
    rewardText: string;
    claimRule: string;
    destroyRule: string;
}

export const FINDABLE_REWARD_ROWS: readonly FindableRewardRow[] = [
    {
        kind: 'shard_spark',
        label: 'Shard spark',
        marker: 'Gold diamond corner glyph',
        rewardText: `+${FINDABLE_MATCH_COMBO_SHARDS.shard_spark} combo shard`,
        claimRule: 'Match the carrier pair.',
        destroyRule: 'Destroy forfeits the shard.'
    },
    {
        kind: 'score_glint',
        label: 'Score glint',
        marker: 'Cyan ring corner glyph',
        rewardText: `+${FINDABLE_MATCH_SCORE.score_glint} score`,
        claimRule: 'Match the carrier pair.',
        destroyRule: 'Destroy forfeits the score.'
    },
    {
        kind: 'ward_spark',
        label: 'Ward spark',
        marker: 'Green shield corner glyph',
        rewardText: '+1 safe hazard ward',
        claimRule: 'Match the carrier pair.',
        destroyRule: 'Destroy forfeits the ward.'
    },
    {
        kind: 'scout_glint',
        label: 'Scout glint',
        marker: 'Violet eye corner glyph',
        rewardText: 'scout one hazard or dungeon family',
        claimRule: 'Match the carrier pair.',
        destroyRule: 'Destroy forfeits the scout.'
    }
] as const;

export const getFindableRewardRow = (kind: FindableKind): FindableRewardRow =>
    FINDABLE_REWARD_ROWS.find((row) => row.kind === kind)!;

export const getFindableKindLabel = (kind: FindableKind): string => getFindableRewardRow(kind).label;

export const getFindableRewardCopy = (kind: FindableKind): string => getFindableRewardRow(kind).rewardText;

export const getFindableRewardText = (kind: FindableKind): string =>
    `${getFindableKindLabel(kind)} pickup: ${getFindableRewardRow(kind).rewardText}.`;

export const getFindableRows = () =>
    FINDABLE_REWARD_ROWS.map((row) => ({
        id: row.kind,
        label: row.label,
        rewardText: row.rewardText,
        score: FINDABLE_MATCH_SCORE[row.kind],
        comboShards: FINDABLE_MATCH_COMBO_SHARDS[row.kind],
        safeHazardWards: FINDABLE_MATCH_SAFE_HAZARD_WARDS[row.kind],
        scoutReveals: FINDABLE_MATCH_SCOUT_REVEALS[row.kind],
        spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS[row.kind],
        destroyText: row.kind === 'score_glint' ? 'Destroy forfeits the score glint.' : row.destroyRule
    }));

export const getFindableSpawnWeightRows = () =>
    FINDABLE_REWARD_ROWS.map((row) => ({
        id: row.kind,
        label: row.label,
        weight: FINDABLE_KIND_SPAWN_WEIGHTS[row.kind]
    }));
