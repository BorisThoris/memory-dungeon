import { clearFieldBudget, clearFieldCircle, clearFieldPairs, createCardField, fieldHash, fieldPairAlive, fieldPairCells, findLiveFieldPair, MAX_FIELD_CARD_EXPONENT, type CardField, type FieldClear } from './card-field';
import { godBuildEffects, godPerkRank, rollGodPerks, type GodPerkId, type GodPerks } from './god-run-perks';

export type GodRunPhase = 'camp' | 'active' | 'cleared' | 'failed';
export type GodEffectKind = 'match' | 'meteor' | 'echo' | 'chain' | 'archive';
export interface GodFieldEffect { id: number; kind: GodEffectKind; x: number; y: number; radius: number; clearedCards: number; atMs: number }
export interface GodRun {
    seed: number;
    wave: number;
    phase: GodRunPhase;
    field: CardField;
    perks: GodPerks;
    /** Decimal integers keep a long run's currency and totals exact beyond Number.MAX_SAFE_INTEGER. */
    gold: string;
    goldMicros: string;
    clearedCards: string;
    charge: number;
    misses: number;
    combo: number;
    manualMatches: number;
    manualMisses: number;
    clockMs: number;
    studyRemainingMs: number;
    cooldownUntilMs: number;
    overdriveUntilMs: number;
    autoRemainder: number;
    clearAtMs: number;
    offers: GodPerkId[];
    pickedPerk: boolean;
    rerolls: number;
    suppliesBought: number;
    nextEffectId: number;
    effects: GodFieldEffect[];
    peakCards: number;
    hand: number[];
    handNonce: number;
    flipped: number[];
    resolveAtMs: number;
}
const MICRO = 1_000_000n;
const CLEAR_HOLD_MS = 1200;
export const GOD_TICK_MAX_MS = 250;
/** The density limit bounds a single field's memory; wave value and builds keep progressing. */
const BASE_FIELD_EXPONENT = 6;
const DENSITY_LIMIT_WAVE = MAX_FIELD_CARD_EXPONENT - BASE_FIELD_EXPONENT + 1;
const scaleForWave = (wave: number) => 2 ** Math.min(40, Math.max(0, wave - 1));
const normalizeGold = (gold: number | string): string => typeof gold === 'string' && /^\d{1,4096}$/.test(gold)
    ? BigInt(gold).toString() : typeof gold === 'number' && Number.isFinite(gold) ? BigInt(Math.max(0, Math.floor(gold))).toString() : '0';

export const createGodRun = (seed: number, gold: number | string = 0, misses = 3): GodRun => {
    const empty = clearFieldBudget(createCardField(MIN_START_EXPONENT, seed), Infinity, 0).field;
    return { seed: seed >>> 0, wave: 0, phase: 'camp', field: empty, perks: {}, gold: normalizeGold(gold), goldMicros: '0', clearedCards: '0', charge: 0,
        misses: Math.max(0, Math.min(4, Math.floor(misses))), combo: 0, manualMatches: 0, manualMisses: 0, clockMs: 0, studyRemainingMs: 0,
        cooldownUntilMs: 0, overdriveUntilMs: 0, autoRemainder: 0, clearAtMs: 0,
        offers: rollGodPerks(seed, 0, 0), pickedPerk: false, rerolls: 0, suppliesBought: 0, nextEffectId: 1, effects: [], peakCards: 0,
        hand: [], handNonce: 0, flipped: [], resolveAtMs: 0 };
};
const MIN_START_EXPONENT = 4;

export const godPerkPrice = (run: GodRun, id: GodPerkId): bigint =>
    ((8n << BigInt(run.wave)) * BigInt(100 + 35 * godPerkRank(run.perks, id))) / 100n;
export const godRerollPrice = (run: GodRun): bigint => (3n << BigInt(run.wave)) * BigInt(run.rerolls + 1);
export const godSupplyPrice = (run: GodRun): bigint => (4n << BigInt(run.wave)) * BigInt(run.suppliesBought + 1);

export const buyGodPerk = (run: GodRun, id: GodPerkId): GodRun => {
    if (run.phase !== 'camp' || run.pickedPerk || !run.offers.includes(id)) return run;
    const cost = godPerkPrice(run, id);
    if (BigInt(run.gold) < cost) return run;
    const perks = { ...run.perks, [id]: godPerkRank(run.perks, id) + 1 };
    return { ...run, perks, gold: (BigInt(run.gold) - cost).toString(), pickedPerk: true,
        misses: Math.min(run.misses, godBuildEffects(perks).missCapacity) };
};
export const rerollGodPerks = (run: GodRun): GodRun => {
    if (run.phase !== 'camp' || run.pickedPerk) return run;
    const cost = godRerollPrice(run);
    if (BigInt(run.gold) < cost) return run;
    return { ...run, gold: (BigInt(run.gold) - cost).toString(), rerolls: run.rerolls + 1, offers: rollGodPerks(run.seed, run.wave, run.rerolls + 1) };
};
export const buyGodMiss = (run: GodRun): GodRun => {
    if (run.phase !== 'camp' || run.misses >= godBuildEffects(run.perks).missCapacity) return run;
    const cost = godSupplyPrice(run);
    if (BigInt(run.gold) < cost) return run;
    return { ...run, gold: (BigInt(run.gold) - cost).toString(), misses: run.misses + 1, suppliesBought: run.suppliesBought + 1 };
};

export const startNextGodWave = (run: GodRun): GodRun => {
    if (run.phase !== 'camp' && run.phase !== 'cleared') return run;
    const wave = run.wave + 1;
    const build = godBuildEffects(run.perks);
    const exponent = Math.min(MAX_FIELD_CARD_EXPONENT, BASE_FIELD_EXPONENT + wave - 1 + build.populationExtraExponent);
    const field = createCardField(exponent, run.seed ^ Math.imul(wave, 0x9e3779b9));
    return dealGodHand({ ...run, wave, field, phase: 'active', studyRemainingMs: build.studyMs, effects: [], autoRemainder: 0,
        misses: Math.min(build.missCapacity, run.misses + (run.wave > 0 ? 1 : 0)),
        peakCards: Math.max(run.peakCards, field.pairCapacity * 2), charge: Math.min(run.charge, build.meteorChargeCost * 2) });
};
const finishWaveIfEmpty = (run: GodRun): GodRun => run.phase === 'active' && run.field.livePairs === 0
    ? { ...run, phase: 'cleared', clearAtMs: run.clockMs } : run;

const applyClear = (run: GodRun, clear: FieldClear, kind: GodEffectKind, x: number, y: number, radius: number, automatic: boolean): GodRun => {
    if (clear.removedPairs === 0) return run;
    const build = godBuildEffects(run.perks);
    const income = build.goldPerPair * (automatic ? build.autoGoldMultiplier : build.burstGoldMultiplier);
    const microsPerPair = BigInt(Math.max(0, Math.round(income * Number(MICRO))));
    const valueScale = 1n << BigInt(Math.max(0, run.wave - DENSITY_LIMIT_WAVE));
    const paid = BigInt(clear.removedPairs) * microsPerPair * valueScale + BigInt(run.goldMicros);
    return { ...run, field: clear.field, gold: (BigInt(run.gold) + paid / MICRO).toString(), goldMicros: (paid % MICRO).toString(),
        clearedCards: (BigInt(run.clearedCards) + BigInt(clear.removedPairs * 2)).toString(),
        nextEffectId: run.nextEffectId + 1,
        effects: [...run.effects.slice(-7), { id: run.nextEffectId, kind, x, y, radius, clearedCards: clear.removedPairs * 2, atMs: run.clockMs }] };
};
const propagate = (run: GodRun, removedPairs: number, automatic: boolean): GodRun => {
    const count = Math.floor(removedPairs * godBuildEffects(run.perks).chainFraction);
    if (count <= 0 || run.field.livePairs === 0) return run;
    const pair = findLiveFieldPair(run.field, run.nextEffectId)!;
    const clear = clearFieldBudget(run.field, count, run.nextEffectId);
    return applyClear(run, clear, 'chain', pair % run.field.columns, Math.floor(pair / run.field.columns), Math.sqrt(clear.removedPairs / Math.PI), automatic);
};

/** Called only after the focused hand has resolved a matching pair. It clears that real pair. */
export const matchGodPair = (run: GodRun, pair: number): GodRun => {
    if (run.phase !== 'active' || run.studyRemainingMs > 0 || !fieldPairAlive(run.field, pair)) return run;
    const build = godBuildEffects(run.perks);
    const x = pair % run.field.columns, y = Math.floor(pair / run.field.columns);
    const direct = clearFieldPairs(run.field, [pair]);
    let next = applyClear(run, direct, 'match', x, y, 0.5, false);
    const power = Math.max(1, Math.floor(build.manualPower * scaleForWave(run.wave) * (1 + Math.min(50, run.combo) * 0.04)));
    const radius = Math.sqrt(power / Math.PI);
    const burst = clearFieldCircle(next.field, x, y, radius, power);
    next = applyClear(next, burst, 'match', x, y, radius, false);
    next = propagate(next, direct.removedPairs + burst.removedPairs, false);
    const combo = run.combo + 1;
    return finishWaveIfEmpty({ ...next, combo, manualMatches: run.manualMatches + 1,
        charge: Math.min(build.meteorChargeCost * 2, run.charge + build.chargePerMatch),
        overdriveUntilMs: build.overdriveMultiplier > 1 ? run.clockMs + 5000 : run.overdriveUntilMs,
        misses: build.healEveryMatches && combo % build.healEveryMatches === 0 ? Math.min(build.missCapacity, run.misses + 1) : run.misses });
};
export const missGodPair = (run: GodRun): GodRun => {
    if (run.phase !== 'active' || run.studyRemainingMs > 0) return run;
    const fraction = Math.round(godBuildEffects(run.perks).missGoldLossFraction * 10_000);
    const lost = BigInt(run.gold) * BigInt(fraction) / 10_000n;
    return { ...run, combo: 0, charge: 0, manualMisses: run.manualMisses + 1, overdriveUntilMs: 0, gold: (BigInt(run.gold) - lost).toString(),
        misses: Math.max(0, run.misses - 1), phase: run.misses <= 0 ? 'failed' : 'active' };
};

export const canCastGodMeteor = (run: GodRun): boolean => {
    const build = godBuildEffects(run.perks);
    return run.phase === 'active' && run.studyRemainingMs <= 0 && (build.meteorUnlocked || run.wave >= 3)
        && run.charge >= build.meteorChargeCost && run.clockMs >= run.cooldownUntilMs;
};
export const castGodMeteor = (run: GodRun, x: number, y: number): GodRun => {
    if (!canCastGodMeteor(run) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= run.field.columns || y >= run.field.rows) return run;
    const build = godBuildEffects(run.perks);
    const power = Math.max(1, Math.floor(build.meteorPower * scaleForWave(run.wave)));
    const radius = Math.sqrt(power / Math.PI);
    const impact = clearFieldCircle(run.field, x, y, radius, power);
    if (impact.removedPairs === 0) return run;
    let next = applyClear(run, impact, 'meteor', x, y, radius, false);
    next = propagate(next, impact.removedPairs, false);
    if (build.echoFraction > 0 && next.field.livePairs > 0) {
        const target = findLiveFieldPair(next.field, next.nextEffectId)!;
        const cells = fieldPairCells(next.field, target)!;
        const cell = cells[next.nextEffectId % 2]!;
        const echoX = cell % next.field.columns, echoY = Math.floor(cell / next.field.columns);
        const echoPower = Math.max(1, Math.floor(power * build.echoFraction));
        const echoRadius = Math.sqrt(echoPower / Math.PI);
        const echo = clearFieldCircle(next.field, echoX, echoY, echoRadius, echoPower);
        next = applyClear(next, echo, 'echo', echoX, echoY, echoRadius, false);
        next = propagate(next, echo.removedPairs, false);
    }
    const cleared = run.field.livePairs - next.field.livePairs;
    return finishWaveIfEmpty({ ...next, charge: run.charge - build.meteorChargeCost, cooldownUntilMs: run.clockMs + build.meteorCooldownMs,
        misses: build.meteorHeal && cleared >= run.field.pairCapacity * 0.1 ? Math.min(build.missCapacity, run.misses + 1) : run.misses });
};

/** Fixed upper step bound: a background tab never accumulates an unbounded backlog. */
export const tickGodRun = (run: GodRun, elapsedMs: number, active = true): GodRun => {
    if (!active || run.phase === 'camp' || run.phase === 'failed' || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return run;
    const dt = Math.min(GOD_TICK_MAX_MS, elapsedMs);
    let next: GodRun = { ...run, clockMs: run.clockMs + dt, studyRemainingMs: Math.max(0, run.studyRemainingMs - dt),
        effects: run.effects.filter(effect => run.clockMs + dt - effect.atMs < 2000) };
    if (run.phase === 'cleared') {
        if (next.clockMs - run.clearAtMs < CLEAR_HOLD_MS) return next;
        if (run.wave % 3 === 0) return { ...next, phase: 'camp', offers: rollGodPerks(run.seed, run.wave, 0), pickedPerk: false, rerolls: 0, suppliesBought: 0 };
        return startNextGodWave(next);
    }
    if (next.resolveAtMs > 0 && next.clockMs >= next.resolveAtMs) {
        const [a, b] = next.flipped;
        const pair = a === undefined ? undefined : next.hand[a];
        if (pair !== undefined && b !== undefined && fieldPairAlive(next.field, pair) && fieldPairAlive(next.field, next.hand[b]!)) {
            next = pair === next.hand[b] ? matchGodPair(next, pair) : missGodPair(next);
        }
        next = { ...next, flipped: [], resolveAtMs: 0 };
        if (next.phase !== 'active') return next;
    }
    const workMs = Math.max(0, dt - run.studyRemainingMs);
    if (workMs === 0) return next;
    const build = godBuildEffects(run.perks);
    const overdrive = run.overdriveUntilMs > run.clockMs ? build.overdriveMultiplier : 1;
    const budget = run.autoRemainder + workMs / 1000 * build.autoPairsPerSecond * scaleForWave(run.wave) * overdrive;
    const pairs = Math.floor(budget);
    next = { ...next, autoRemainder: budget - pairs };
    if (pairs > 0 && next.field.livePairs > 0) {
        const target = findLiveFieldPair(next.field, next.nextEffectId)!;
        const clear = clearFieldBudget(next.field, pairs, next.nextEffectId);
        next = applyClear(next, clear, 'archive', target % next.field.columns, Math.floor(target / next.field.columns), Math.sqrt(clear.removedPairs / Math.PI), true);
        next = propagate(next, clear.removedPairs, true);
    }
    return reconcileGodHand(finishWaveIfEmpty(next));
};

/** A bounded hand consists of real surviving field pairs, with stable positions until exhausted. */
export const dealGodHand = (run: GodRun): GodRun => {
    const pairs: number[] = [];
    const nonce = run.handNonce + 1;
    for (let n = 0; n < 64 && pairs.length < Math.min(6, run.field.livePairs); n++) {
        const pair = findLiveFieldPair(run.field, fieldHash(nonce * 71 + n));
        if (pair !== null && !pairs.includes(pair)) pairs.push(pair);
    }
    // Fragmented last words may repeatedly select the same first bit.
    for (let w = 0; pairs.length < Math.min(6, run.field.livePairs) && w < run.field.aliveWords.length; w++) {
        let word = run.field.aliveWords[w]!;
        while (word && pairs.length < Math.min(6, run.field.livePairs)) {
            const bit = 31 - Math.clz32((word & -word) >>> 0), pair = w * 32 + bit;
            if (!pairs.includes(pair)) pairs.push(pair);
            word = (word & (word - 1)) >>> 0;
        }
    }
    const hand = pairs.flatMap(pair => [pair, pair]);
    for (let i = hand.length - 1; i > 0; i--) {
        const j = fieldHash(run.seed ^ nonce ^ Math.imul(i, 0x9e3779b9)) % (i + 1);
        [hand[i], hand[j]] = [hand[j]!, hand[i]!];
    }
    return { ...run, hand, handNonce: nonce, flipped: [], resolveAtMs: 0, studyRemainingMs: godBuildEffects(run.perks).studyMs };
};
export const reconcileGodHand = (run: GodRun): GodRun => {
    if (run.phase !== 'active') return run;
    if (!run.hand.some(pair => fieldPairAlive(run.field, pair))) return dealGodHand(run);
    if (run.flipped.some(index => !fieldPairAlive(run.field, run.hand[index]!))) return { ...run, flipped: [], resolveAtMs: 0 };
    return run;
};
export const flipGodCard = (run: GodRun, index: number): GodRun => {
    if (run.phase !== 'active' || run.studyRemainingMs > 0 || run.resolveAtMs > 0 || !Number.isInteger(index) || index < 0 || index >= run.hand.length || run.flipped.includes(index) || !fieldPairAlive(run.field, run.hand[index]!)) return run;
    const flipped = [...run.flipped, index];
    return { ...run, flipped, resolveAtMs: flipped.length === 2 ? run.clockMs + 650 : 0 };
};

export type GodRunCommand = { type: 'tick'; ms: number } | { type: 'flip'; index: number } | { type: 'meteor'; x: number; y: number } | { type: 'buy'; id: GodPerkId } | { type: 'reroll' | 'supply' | 'continue' };
export const reduceGodRun = (run: GodRun, command: GodRunCommand): GodRun => {
    switch (command.type) {
        case 'tick': return tickGodRun(run, command.ms);
        case 'flip': return flipGodCard(run, command.index);
        case 'meteor': return reconcileGodHand(castGodMeteor(run, command.x, command.y));
        case 'buy': return buyGodPerk(run, command.id);
        case 'reroll': return rerollGodPerks(run);
        case 'supply': return buyGodMiss(run);
        case 'continue': return run.phase === 'camp' ? startNextGodWave(run) : run;
    }
};
