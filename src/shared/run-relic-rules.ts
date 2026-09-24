import type { RelicId, RunState } from './contracts';

/**
 * Relics, back - bought, not drafted.
 *
 * Gen 175 removed the milestone relic draft with the starting loadouts, because the draft was a
 * door between floors and the loadouts were decided before the player knew the run
 * (`docs/REMOVED_DUNGEON_LAYER.md`). The store came back on 2026-09-23 as a sheet on the pause
 * menu; relics come back the same way on 2026-09-24: bought with the gold a run earns at its floor
 * clears, once each, and kept for the rest of the run. Nothing stops for them.
 *
 * Each one acts on a clock the player winds - the miss bank, the chain, the study window - rather
 * than rewriting the board at generation, which is the kind of change this player asked for
 * (`in-play mutators`, 2026-09-24).
 */
export type { RelicId };

export interface RelicDefinition {
    id: RelicId;
    title: string;
    body: string;
    price: number;
}

/** The miss bank's cap with Deep Pockets. */
export const DEEP_POCKETS_CAP = 5;
/** Gold Gilded Chain pays on every rung of the chain that earns a miss. */
export const GILDED_CHAIN_GOLD = 2;
/** Milliseconds Long Look adds to every floor's study window. */
export const LONG_LOOK_MS = 1000;

export const RELICS: readonly RelicDefinition[] = [
    {
        id: 'deep_pockets',
        title: 'Deep Pockets',
        body: 'The miss bank holds five instead of four.',
        price: 9
    },
    {
        id: 'gilded_chain',
        title: 'Gilded Chain',
        body: `Every fifth match in a row - the rung that earns a miss - also pays ${GILDED_CHAIN_GOLD} gold.`,
        price: 8
    },
    {
        id: 'long_look',
        title: 'Long Look',
        body: `Every floor's study window lasts a second longer.`,
        price: 10
    }
];

export const RELIC_IDS: readonly RelicId[] = RELICS.map((relic) => relic.id);

export const isRelicId = (value: unknown): value is RelicId => RELIC_IDS.includes(value as RelicId);

export const hasRelic = (run: Pick<RunState, 'relics'>, id: RelicId): boolean => (run.relics ?? []).includes(id);

export const relicDefinition = (id: RelicId): RelicDefinition => RELICS.find((relic) => relic.id === id)!;
