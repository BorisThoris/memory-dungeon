import { FINDABLE_KIND_SPAWN_WEIGHTS, FINDABLE_MATCH_SCORE, type FindableKind } from './contracts';

export interface FindableRewardRow {
    kind: FindableKind;
    label: string;
    marker: string;
    rewardText: string;
    claimRule: string;
    /** What happens when a chunk break takes the carrier instead of a match. */
    breakRule: string;
}

/** Match rewards: immediate score or a player-triggered inventory item. */
const FINDABLE_REWARD_ROW_ORDER = ['score_glint', 'meteor_shard'] as const satisfies readonly FindableKind[];

const FINDABLE_REWARD_ROW_BY_KIND = {
    meteor_shard: {
        kind: 'meteor_shard', label: 'Meteor shard', marker: 'Amber meteor corner glyph',
        rewardText: '+1 meteor in your inventory', claimRule: 'Match the carrier pair, then call the meteor yourself.',
        breakRule: 'Destroyed shards are lost; meteors never refill themselves.'
    },
    score_glint: {
        kind: 'score_glint',
        label: 'Score glint',
        marker: 'Cyan ring corner glyph',
        rewardText: `+${FINDABLE_MATCH_SCORE.score_glint} score`,
        claimRule: 'Match the carrier pair.',
        breakRule: 'A break that takes the carrier spills the glint and pays it anyway.'
    }
} as const satisfies Record<FindableKind, FindableRewardRow>;

export const FINDABLE_REWARD_ROWS: readonly FindableRewardRow[] = FINDABLE_REWARD_ROW_ORDER.map(
    (kind) => FINDABLE_REWARD_ROW_BY_KIND[kind]
);

export const getFindableRewardRow = (kind: FindableKind): FindableRewardRow => FINDABLE_REWARD_ROW_BY_KIND[kind];

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
        spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS[row.kind],
        breakText: row.breakRule
    }));

export const getFindableSpawnWeightRows = () =>
    FINDABLE_REWARD_ROWS.map((row) => ({
        id: row.kind,
        label: row.label,
        weight: FINDABLE_KIND_SPAWN_WEIGHTS[row.kind]
    }));
