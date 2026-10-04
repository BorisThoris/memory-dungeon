import { createMulberry32, hashStringToSeed } from './rng';

export const GOD_PERKS = {
    comet_core: { title: 'Comet Core', role: 'engine', rarity: 'uncommon', benefit: 'Unlock meteors early and increase impact power.', drawback: 'Larger comets need more charge.', stacking: 'More impact power; charge cost grows more slowly.' },
    archive_swarm: { title: 'Archive Swarm', role: 'engine', rarity: 'common', benefit: 'Archivists automatically clear real pairs every second.', drawback: 'Your manual matches generate less meteor charge.', stacking: 'More archivists and a larger charge penalty.' },
    focused_memory: { title: 'Focused Memory', role: 'engine', rarity: 'common', benefit: 'Manual matches clear larger areas and generate more charge.', drawback: 'Automatic clearing slows down.', stacking: 'Stronger manual bursts; increasingly specialized toward active play.' },
    orbital_echo: { title: 'Orbital Echo', role: 'modifier', rarity: 'rare', benefit: 'Meteors send a second impact into surviving cards.', drawback: 'Meteors take longer to cool down.', stacking: 'Stronger echoes with diminishing returns; longer cooldowns.' },
    static_lattice: { title: 'Static Lattice', role: 'modifier', rarity: 'uncommon', benefit: 'Clearing events propagate into additional live pairs.', drawback: 'The initial burst is weaker.', stacking: 'More propagation, with diminishing returns, and weaker first hits.' },
    overclock: { title: 'Overclock', role: 'modifier', rarity: 'uncommon', benefit: 'Automatic engines run faster.', drawback: 'Manual matches contribute less meteor charge.', stacking: 'Faster automation and a larger charge penalty.' },
    replicator: { title: 'Replicator', role: 'economy', rarity: 'rare', benefit: 'Larger future fields and more gold per cleared pair.', drawback: 'The extra cards must actually be cleared to finish each wave.', stacking: 'Field size doubles at ranks 1, 3, 7 and 15; income keeps growing.' },
    midas_ash: { title: 'Midas Ash', role: 'economy', rarity: 'uncommon', benefit: 'Manual bursts and meteors pay more gold.', drawback: 'Automatic clears pay less gold.', stacking: 'Larger burst rewards and lower automatic income.' },
    greed_contract: { title: 'Greed Contract', role: 'economy', rarity: 'common', benefit: 'Every cleared pair pays more gold.', drawback: 'A mismatch loses a portion of your unspent gold.', stacking: 'More income; the loss grows toward 40% of held gold.' },
    glass_mind: { title: 'Glass Mind', role: 'modifier', rarity: 'rare', benefit: 'All clearing engines become stronger.', drawback: 'Your maximum miss bank shrinks.', stacking: 'More power; lose another miss slot at square-number ranks, down to one.' },
    deep_memory: { title: 'Deep Memory', role: 'survival', rarity: 'common', benefit: 'A larger miss bank and more time to study each focused hand.', drawback: 'All clears pay less gold.', stacking: 'Extra capacity and study time grow with diminishing returns.' },
    living_roots: { title: 'Living Roots', role: 'survival', rarity: 'uncommon', benefit: 'Consecutive manual matches periodically restore a miss.', drawback: 'Meteors cool down more slowly.', stacking: 'Faster healing, down to every two matches; longer cooldowns.' }
} as const;
export type GodPerkId = keyof typeof GOD_PERKS;
export type GodPerks = Partial<Record<GodPerkId, number>>;
export const GOD_PERK_IDS = Object.keys(GOD_PERKS) as GodPerkId[];
export const godPerkRank = (perks: GodPerks, id: GodPerkId): number => {
    const rank = perks[id] ?? 0;
    return Number.isFinite(rank) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(rank))) : 0;
};
export const isGodPerkId = (id: string): id is GodPerkId => Object.hasOwn(GOD_PERKS, id);

export interface GodBuildEffects {
    meteorUnlocked: boolean;
    manualPower: number;
    meteorPower: number;
    meteorChargeCost: number;
    chargePerMatch: number;
    meteorCooldownMs: number;
    autoPairsPerSecond: number;
    chainFraction: number;
    echoFraction: number;
    goldPerPair: number;
    burstGoldMultiplier: number;
    autoGoldMultiplier: number;
    populationExtraExponent: number;
    missCapacity: number;
    studyMs: number;
    healEveryMatches: number | null;
    missGoldLossFraction: number;
    overdriveMultiplier: number;
    meteorHeal: boolean;
}

/** These values are consumed by the mass-field engine; every listed downside changes a rule. */
export const godBuildEffects = (perks: GodPerks): GodBuildEffects => {
    const rank = (id: GodPerkId) => godPerkRank(perks, id);
    const comet = rank('comet_core'), swarm = rank('archive_swarm'), focus = rank('focused_memory');
    const echo = rank('orbital_echo'), lattice = rank('static_lattice'), clock = rank('overclock');
    const replicate = rank('replicator'), midas = rank('midas_ash'), greed = rank('greed_contract');
    const glass = rank('glass_mind'), memory = rank('deep_memory'), roots = rank('living_roots');
    const power = (1 + glass) / (1 + 0.12 * lattice);
    return {
        meteorUnlocked: comet > 0,
        manualPower: 2 * (1 + 1.25 * focus) * power,
        meteorPower: 12 * (1 + 1.5 * comet) * power,
        meteorChargeCost: 80 * (1 + 0.15 * Math.sqrt(comet)),
        chargePerMatch: 20 * (1 + 0.4 * Math.sqrt(focus)) / ((1 + 0.2 * swarm) * (1 + 0.15 * clock)),
        meteorCooldownMs: 3500 * (1 + 0.15 * echo + 0.1 * roots),
        autoPairsPerSecond: 1.5 * swarm * (1 + 0.75 * clock) * power / (1 + 0.3 * focus),
        chainFraction: 0.2 * Math.sqrt(lattice),
        echoFraction: 0.35 * Math.sqrt(echo),
        goldPerPair: 0.5 * (1 + 0.75 * greed) * (1 + 0.2 * replicate) / (1 + 0.15 * memory),
        burstGoldMultiplier: (1 + midas) * (comet > 0 && midas > 0 ? 1.25 : 1),
        autoGoldMultiplier: 1 / (1 + 0.4 * midas),
        populationExtraExponent: Math.floor(Math.log2(1 + replicate)),
        missCapacity: Math.max(1, 4 + Math.floor(2 * Math.sqrt(memory)) - Math.floor(Math.sqrt(glass))),
        studyMs: 1600 + 350 * Math.sqrt(memory),
        healEveryMatches: roots > 0 ? Math.max(2, Math.ceil(8 / (1 + Math.sqrt(roots)))) : null,
        missGoldLossFraction: 0.4 * greed / (greed + 4),
        overdriveMultiplier: swarm > 0 && focus > 0 ? 2 + 0.1 * Math.sqrt(Math.min(swarm, focus)) : 1,
        meteorHeal: glass > 0 && roots > 0
    };
};

const SYNERGIES: readonly { ids: readonly GodPerkId[]; title: string; body: string }[] = [
    { ids: ['comet_core', 'static_lattice'], title: 'Thunderfall', body: 'Meteor clears feed chain propagation into surviving pairs.' },
    { ids: ['comet_core', 'midas_ash'], title: 'Golden Crater', body: 'Comets and manual bursts earn an extra 25% gold on top of Midas Ash.' },
    { ids: ['archive_swarm', 'focused_memory'], title: 'Working Memory', body: 'A manual match overdrives your archivists for 5 seconds.' },
    { ids: ['glass_mind', 'living_roots'], title: 'Tempered Glass', body: 'A meteor that clears at least 10% of the field restores one miss.' },
    { ids: ['replicator', 'archive_swarm'], title: 'Living Library', body: 'More cards fund growth while archivists work through the larger field.' },
    { ids: ['orbital_echo', 'static_lattice'], title: 'Afterstorm', body: 'The second meteor impact also feeds chain propagation.' }
];
export const godBuildSynergies = (perks: GodPerks) => SYNERGIES.filter(synergy => synergy.ids.every(id => godPerkRank(perks, id) > 0));
export const godPerkPotentialSynergies = (perks: GodPerks, id: GodPerkId) => SYNERGIES.filter(synergy => synergy.ids.includes(id) && synergy.ids.every(required => required === id || godPerkRank(perks, required) > 0));

/** Three reproducible choices, always including an engine; one purchase per camp.
 * Repeated perks remain possible and stack without the old three-rank ceiling.
 */
export const rollGodPerks = (seed: number, wave: number, rerolls: number): GodPerkId[] => {
    const rng = createMulberry32(hashStringToSeed(`god-perks:${seed}:${wave}:${rerolls}`));
    const engines = GOD_PERK_IDS.filter(id => GOD_PERKS[id].role === 'engine');
    const choices: GodPerkId[] = [engines[Math.floor(rng() * engines.length)]!];
    const bag = GOD_PERK_IDS.flatMap(id => new Array<GodPerkId>(GOD_PERKS[id].rarity === 'common' ? 4 : GOD_PERKS[id].rarity === 'uncommon' ? 2 : 1).fill(id));
    while (choices.length < 3) {
        const remaining = bag.filter(id => !choices.includes(id));
        choices.push(remaining[Math.floor(rng() * remaining.length)]!);
    }
    return choices;
};
