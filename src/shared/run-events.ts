import { hashStringToSeed } from './rng';
import type { RunState } from './contracts';

export type RunEventId =
    | 'lost_cache'
    | 'mirror_bargain'
    | 'quiet_lantern'
    | 'sealed_keyring'
    | 'cracked_altar'
    | 'trap_survey';
export type RunEventChoiceEffect =
    | 'gain_shop_gold'
    | 'gain_relic_favor'
    | 'heal_or_guard'
    | 'gain_iron_key'
    | 'gain_destroy_charge'
    | 'gain_score'
    | 'skip';

export interface RunEventChoice {
    id: string;
    label: string;
    effect: RunEventChoiceEffect;
    detail: string;
    resultText?: string;
}

export interface RunEventDefinition {
    id: RunEventId;
    title: string;
    body: string;
    choices: readonly RunEventChoice[];
}

export interface RunEventState extends RunEventDefinition {
    eventKey: string;
    runSeed: number;
    rulesVersion: number;
    floor: number;
    offlineOnly: true;
    options: readonly (RunEventChoice & { resultText: string })[];
}

export const RUN_EVENT_TABLE: readonly RunEventDefinition[] = [
    {
        id: 'lost_cache',
        title: 'Lost cache',
        body: 'A sealed satchel lies between rooms. It can fund the vendor, or you can leave it untouched.',
        choices: [
            { id: 'take_gold', label: 'Take 2 gold', effect: 'gain_shop_gold', detail: '+2 shop gold this run.' },
            { id: 'leave_cache', label: 'Leave it', effect: 'skip', detail: 'No change; safest for purist routing.' }
        ]
    },
    {
        id: 'mirror_bargain',
        title: 'Mirror bargain',
        body: 'The mirror offers relic momentum in exchange for a riskier route memory.',
        choices: [
            { id: 'accept_favor', label: 'Accept favor', effect: 'gain_relic_favor', detail: '+1 relic Favor progress.' },
            { id: 'decline_mirror', label: 'Decline', effect: 'skip', detail: 'No change.' }
        ]
    },
    {
        id: 'quiet_lantern',
        title: 'Quiet lantern',
        body: 'A dim lantern steadies the party before the next floor.',
        choices: [
            { id: 'rest_light', label: 'Rest in the light', effect: 'heal_or_guard', detail: '+1 life if wounded; otherwise +1 guard token if uncapped.' },
            { id: 'press_on', label: 'Press on', effect: 'skip', detail: 'No change.' }
        ]
    },
    {
        id: 'sealed_keyring',
        title: 'Sealed keyring',
        body: 'A brittle keyring hangs from a cracked route marker. Breaking it makes noise, but the key is real.',
        choices: [
            { id: 'break_keyring', label: 'Take the key', effect: 'gain_iron_key', detail: '+1 iron key for dungeon locks.' },
            { id: 'sell_keyring', label: 'Pocket the coin', effect: 'gain_shop_gold', detail: '+2 shop gold this run.' },
            { id: 'leave_keyring', label: 'Leave it', effect: 'skip', detail: 'No change.' }
        ]
    },
    {
        id: 'cracked_altar',
        title: 'Cracked altar',
        body: 'The altar hums with old Favor, but its safer light can also steady the next floor.',
        choices: [
            { id: 'take_favor', label: 'Draw Favor', effect: 'gain_relic_favor', detail: '+1 relic Favor progress.' },
            { id: 'take_shelter', label: 'Take shelter', effect: 'heal_or_guard', detail: '+1 life if wounded; otherwise +1 guard token if uncapped.' },
            { id: 'ignore_altar', label: 'Move on', effect: 'skip', detail: 'No change.' }
        ]
    },
    {
        id: 'trap_survey',
        title: 'Trap survey',
        body: 'Old chalk marks describe the next room mechanisms. You can turn the notes into tools or score.',
        choices: [
            { id: 'prep_tools', label: 'Prepare tools', effect: 'gain_destroy_charge', detail: '+1 destroy charge to the uncapped run bank.' },
            { id: 'study_marks', label: 'Study the marks', effect: 'gain_score', detail: '+25 score.' },
            { id: 'skip_marks', label: 'Skip the marks', effect: 'skip', detail: 'No change.' }
        ]
    }
] as const;

const eventIndexFor = (runSeed: number, rulesVersion: number, floor: number): number => {
    const seed = hashStringToSeed(`runEvent:${rulesVersion}:${runSeed}:${floor}`);
    return Math.abs(seed) % RUN_EVENT_TABLE.length;
};

export const generateRunEvent = ({
    runSeed,
    rulesVersion,
    floor
}: {
    runSeed: number;
    rulesVersion: number;
    floor: number;
}): RunEventState => {
    const def = RUN_EVENT_TABLE[eventIndexFor(runSeed, rulesVersion, floor)]!;
    return {
        ...def,
        options: def.choices.map((choice) => ({ ...choice, resultText: choice.detail })),
        eventKey: `${rulesVersion}:${runSeed}:${floor}:${def.id}`,
        runSeed,
        rulesVersion,
        floor,
        offlineOnly: true
    };
};

export const rollRunEventRoom = generateRunEvent;

export interface RunEventPreviewState {
    shopGold: number;
    lives: number;
    relicFavorProgress: number;
    destroyPairCharges?: number;
}

export const chooseRunEventOption = (
    state: RunEventPreviewState,
    event: RunEventState,
    choiceId: string
): {
    applied: boolean;
    eventId: RunEventId;
    choiceId: string;
    next: RunEventPreviewState;
    reason?: 'missing_choice';
} => {
    const choice = event.options.find((item) => item.id === choiceId);
    if (!choice) {
        return { applied: false, eventId: event.id, choiceId, next: state, reason: 'missing_choice' };
    }
    let next = { ...state };
    if (choice.effect === 'gain_shop_gold') {
        next = { ...next, shopGold: next.shopGold + 2 };
    } else if (choice.effect === 'gain_relic_favor') {
        next = { ...next, relicFavorProgress: (next.relicFavorProgress + 1) % 3 };
    } else if (choice.effect === 'heal_or_guard') {
        next = { ...next, lives: Math.min(5, next.lives + 1) };
    } else if (choice.effect === 'gain_destroy_charge') {
        next = { ...next, destroyPairCharges: (next.destroyPairCharges ?? 0) + 1 };
    } else if (choice.effect === 'gain_iron_key' || choice.effect === 'gain_score') {
        next = { ...next, shopGold: next.shopGold };
    }
    return { applied: true, eventId: event.id, choiceId, next };
};

export interface RunEventResolution {
    run: RunState;
    applied: boolean;
    reason?: 'missing_choice';
}

export interface RunEventCatalogRow {
    id: RunEventId;
    title: string;
    conditionText: string;
    choiceCount: number;
    choices: Array<Pick<RunEventChoice, 'id' | 'label' | 'effect' | 'detail'>>;
}

export const getRunEventCatalogRows = (): RunEventCatalogRow[] =>
    RUN_EVENT_TABLE.map((event) => ({
        id: event.id,
        title: event.title,
        conditionText: 'Seed-stable local event room; selected by run seed, rules version, and floor.',
        choiceCount: event.choices.length,
        choices: event.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            effect: choice.effect,
            detail: choice.detail
        }))
    }));

const gainOneFavor = (run: RunState): RunState => {
    const total = run.relicFavorProgress + 1;
    const bonusPicks = Math.floor(total / 3);
    return {
        ...run,
        bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer + bonusPicks,
        favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer + bonusPicks,
        relicFavorProgress: total % 3
    };
};

export const applyRunEventChoice = (
    run: RunState,
    event: RunEventState,
    choiceId: string
): RunEventResolution => {
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) {
        return { run, applied: false, reason: 'missing_choice' };
    }
    switch (choice.effect) {
        case 'gain_shop_gold':
            return { run: { ...run, shopGold: run.shopGold + 2 }, applied: true };
        case 'gain_relic_favor':
            return { run: gainOneFavor(run), applied: true };
        case 'heal_or_guard':
            if (run.lives < 5) {
                return { run: { ...run, lives: run.lives + 1 }, applied: true };
            }
            return {
                run: { ...run, stats: { ...run.stats, guardTokens: Math.min(2, run.stats.guardTokens + 1) } },
                applied: true
            };
        case 'gain_iron_key':
            return {
                run: { ...run, dungeonKeys: { ...run.dungeonKeys, iron: (run.dungeonKeys.iron ?? 0) + 1 } },
                applied: true
            };
        case 'gain_destroy_charge':
            return { run: { ...run, destroyPairCharges: run.destroyPairCharges + 1 }, applied: true };
        case 'gain_score':
            return {
                run: {
                    ...run,
                    stats: {
                        ...run.stats,
                        totalScore: run.stats.totalScore + 25,
                        currentLevelScore: run.stats.currentLevelScore + 25,
                        bestScore: Math.max(run.stats.bestScore, run.stats.totalScore + 25)
                    }
                },
                applied: true
            };
        case 'skip':
        default:
            return { run, applied: true };
    }
};
