import { restoreCardField, serializeCardField } from './card-field';
import { createGodRun, type GodRun } from './god-run-engine';
import { godBuildEffects, isGodPerkId } from './god-run-perks';

export const serializeGodRun = (run: GodRun) => ({ version: 1, state: { ...run, field: serializeCardField(run.field) } });
export const restoreGodRun = (value: unknown): GodRun | null => {
    if (!value || typeof value !== 'object') return null;
    const saved = value as ReturnType<typeof serializeGodRun>;
    if (saved.version !== 1 || !saved.state || typeof saved.state !== 'object') return null;
    const input = saved.state;
    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff || !Number.isInteger(input.wave) || input.wave < 0 || input.wave > 1_000_000) return null;
    if (!['camp','active','cleared','failed'].includes(input.phase)) return null;
    for (const key of ['gold','goldMicros','clearedCards'] as const) if (typeof input[key] !== 'string' || !/^\d{1,400000}$/.test(input[key])) return null;
    if (BigInt(input.goldMicros) >= 1_000_000n) return null;
    const template = createGodRun(input.seed);
    for (const key of Object.keys(template) as (keyof GodRun)[]) {
        if (typeof template[key] === 'number' && (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || (input[key] as number) < 0 || (input[key] as number) > Number.MAX_SAFE_INTEGER)) return null;
    }
    if (!input.perks || typeof input.perks !== 'object' || Array.isArray(input.perks)) return null;
    for (const [id, rank] of Object.entries(input.perks)) if (!isGodPerkId(id) || !Number.isSafeInteger(rank) || rank! < 1) return null;
    if (!Array.isArray(input.offers) || input.offers.length !== 3 || new Set(input.offers).size !== 3 || input.offers.some(id => !isGodPerkId(id))) return null;
    if (typeof input.pickedPerk !== 'boolean' || !Array.isArray(input.hand) || input.hand.length > 12 || !Array.isArray(input.flipped) || input.flipped.length > 2 || new Set(input.flipped).size !== input.flipped.length) return null;
    const field = restoreCardField(input.field); if (!field) return null;
    if (input.hand.some(pair => !Number.isInteger(pair) || pair < 0 || pair >= field.pairCapacity)) return null;
    if ([...new Set(input.hand)].some(pair => input.hand.filter(p => p === pair).length !== 2)) return null;
    if (input.flipped.some(index => !Number.isInteger(index) || index < 0 || index >= input.hand.length)) return null;
    if (input.misses > godBuildEffects(input.perks).missCapacity || !Number.isInteger(input.misses)) return null;
    if ((input.phase === 'camp' || input.phase === 'cleared') && field.livePairs !== 0) return null;
    if (input.phase === 'active' && (field.livePairs === 0 || input.hand.length === 0)) return null;
    // Visual events need not be replayed after a reload. Rules, hand and engine timing are retained.
    return { ...input, field, effects: [], perks: { ...input.perks }, hand: [...input.hand], flipped: [...input.flipped], offers: [...input.offers] };
};
