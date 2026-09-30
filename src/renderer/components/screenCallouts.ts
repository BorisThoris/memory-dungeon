import type { RunState } from '../../shared/contracts';
import { comboMissesEarned } from '../../shared/miss-bank';
import {
    COMBO_HEAT_STAGE_FROM,
    COMBO_HEAT_THEMES,
    COMBO_MILESTONE_CALLOUT,
    comboAscensionCallout,
    comboAscensionReached,
    comboHeatStage,
    comboMilestoneReached,
    comboStageReached,
    type ComboHeatStage,
    type ComboHeatTheme
} from '../../shared/combo-heat-rules';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { STORE_ITEMS, type StoreItemId } from '../../shared/run-store-rules';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';

/**
 * The screen stamps (`ScreenCalloutQueue`): every moment the run wants the whole screen for,
 * as data, derived from the turn event that made it so nothing here replays on a mount or a
 * restore. The arcade tables the feedback loop is modelled on stamp the good and the bad alike -
 * the rank-up and the streak lost get the same slam - and they stamp the pickups, so the
 * things a run hands out are felt as the same currency as the combo. Six kinds:
 *
 * - `rank`: the combo reached a heat stage (`comboStageReached`). Major.
 * - `broken`: a miss ended a combo of Hot or better. Major, in the miss's red.
 * - `last`: a miss spent the bank's last miss. Major: the next one ends the run.
 * - `miss`: any other miss - the bank saved it, and says how many it has left. Minor.
 * - `banked`: five in a row earned a miss (`comboMissesEarned`). Minor, gold.
 * - `pickup`: a findable was claimed with the match. Minor, cyan.
 * - `bought`: a store purchase. Minor, gold, derived from the purchase count going up.
 *
 * Major stamps take the centre and hold; minors sit higher and go faster. When one turn makes
 * several, they play in this order, which is the order of what the player most needs to know.
 */
export type ScreenCalloutKind = 'rank' | 'milestone' | 'temper' | 'broken' | 'last' | 'miss' | 'banked' | 'pickup' | 'bought' | 'ignite' | 'zone';
export type ScreenCalloutTone = 'hot' | 'blazing' | 'inferno' | 'legendary' | 'miss' | 'gold' | 'cyan';

export interface ScreenCallout {
    /** Unique per moment: the queue plays each key once. */
    key: string;
    kind: ScreenCalloutKind;
    size: 'major' | 'minor';
    tone: ScreenCalloutTone;
    title: string;
    sub: string;
    /** The temper's own colour for the stamp, over the tone's. */
    color?: string;
    /** The shiny's stamps: tagged rare, palette cycling. */
    rare?: boolean;
}

type TurnEvent = BoardTurnResolvedEvent;

const ORDER: readonly ScreenCalloutKind[] = ['ignite', 'zone', 'milestone', 'rank', 'temper', 'broken', 'last', 'banked', 'pickup', 'miss', 'bought'];

const isMiss = (event: TurnEvent): boolean => event.outcome === 'mismatch' || event.outcome === 'gambit_mismatch';

/** The stamps one resolved turn earns, given the misses the bank holds after it. */
export const deriveTurnCallouts = (
    event: TurnEvent | null,
    missesLeftAfter: number | null,
    temper: ComboHeatTheme = COMBO_HEAT_THEMES[0]!
): ScreenCallout[] => {
    if (!event) return [];
    const { currentStreakBefore: before, currentStreakAfter: after } = event.announcement;
    const id = event.eventId;
    const callouts: ScreenCallout[] = [];
    const rare = temper.rare ? { rare: true } : {};
    const milestone = comboMilestoneReached(before, after);
    if (milestone !== null) {
        callouts.push({ key: `milestone:${id}`, kind: 'milestone', size: 'major', tone: 'legendary', title: COMBO_MILESTONE_CALLOUT(milestone), sub: `Combo ×${after} · a rare one`, color: temper.colors[5], ...rare });
    }
    const ascension = comboAscensionReached(before, after);
    if (ascension !== null) {
        callouts.push({ key: `ascend:${id}`, kind: 'rank', size: 'major', tone: 'legendary', title: comboAscensionCallout(temper.callouts.legendary, ascension), sub: temper.rare ? `RARE · Combo ×${after}` : `Combo ×${after}`, color: temper.colors[5], ...rare });
    }
    const stage = comboStageReached(before, after);
    if (stage) {
        callouts.push({ key: `rank:${id}`, kind: 'rank', size: 'major', tone: stage, title: temper.callouts[stage], sub: temper.rare ? `RARE · Combo ×${after}` : `Combo ×${after}`, color: temper.colors[comboHeatStageIndexOf(stage)], ...rare });
    }
    // The temper shows itself the first time the combo warms: a frost run says it is one, and
    // so does an ember run, so every run names the weather the room has been showing.
    if (comboHeatStage(before) === 'cold' && comboHeatStage(after) !== 'cold') {
        callouts.push({ key: `temper:${id}`, kind: 'temper', size: 'minor', tone: 'gold', title: `${temper.title.toUpperCase()} RUN`, sub: temper.rare ? 'Rare · one run in fifty' : 'This run\'s temper, from its seed', color: temper.colors[2], ...rare });
    }
    if (isMiss(event)) {
        const lost = before >= COMBO_HEAT_STAGE_FROM.hot;
        const last = missesLeftAfter === 0;
        if (lost) {
            callouts.push({ key: `broken:${id}`, kind: 'broken', size: 'major', tone: 'miss', title: 'COMBO BROKEN', sub: `×${before} lost${last ? ' · last miss' : ''}` });
        } else if (last) {
            callouts.push({ key: `last:${id}`, kind: 'last', size: 'major', tone: 'miss', title: 'LAST MISS!', sub: 'One more ends the run' });
        } else if (missesLeftAfter !== null) {
            callouts.push({ key: `miss:${id}`, kind: 'miss', size: 'minor', tone: 'miss', title: 'MISS', sub: `The bank saved it · ${missesLeftAfter} left` });
        }
    }
    const earned = comboMissesEarned(before, after);
    if (earned > 0) {
        callouts.push({ key: `banked:${id}`, kind: 'banked', size: 'minor', tone: 'gold', title: 'MISS BANKED', sub: `+${earned} · five in a row` });
    }
    if (event.matchedFindableKind) {
        const kind = event.matchedFindableKind;
        callouts.push({ key: `pickup:${id}`, kind: 'pickup', size: 'minor', tone: 'cyan', title: `${getFindableKindLabel(kind).toUpperCase()}!`, sub: getFindableRewardCopy(kind) });
    }
    return callouts.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
};

/** The stamps for purchases made since `previous`: one per unit bought, keyed by the count reached. */
/**
 * The Zone's stamps (`zone-rules.ts`): IGNITION when a Zone opens (the count going up), and the
 * verdict when one resolves (a new `lastZone` key): PERFECT ZONE when every pair matched and
 * nothing missed, ZONE ×n otherwise, in the miss's red when the leftovers cost the bank.
 */
export const deriveZoneCallouts = (
    previous: Pick<RunState, 'zonesThisRun' | 'lastZone'> | undefined,
    next: Pick<RunState, 'zonesThisRun' | 'lastZone'>
): ScreenCallout[] => {
    const callouts: ScreenCallout[] = [];
    const was = previous?.zonesThisRun ?? 0;
    const now = next.zonesThisRun ?? 0;
    for (let count = was + 1; count <= now; count += 1) {
        callouts.push({ key: `ignite:${count}`, kind: 'ignite', size: 'major', tone: 'inferno', title: 'IGNITION!', sub: 'The Zone is open: nothing resolves until you do' });
    }
    const last = next.lastZone;
    if (last && last.key !== previous?.lastZone?.key) {
        const perfect = last.missed === 0 && last.matched === last.pairs;
        callouts.push({
            key: last.key,
            kind: 'zone',
            size: 'major',
            tone: perfect ? 'legendary' : last.missed > 0 ? 'miss' : 'gold',
            title: perfect ? 'PERFECT ZONE!' : `ZONE ×${last.matched}`,
            sub: last.missed > 0 ? `+${last.bonus} · ${last.missed} ${last.missed === 1 ? 'miss' : 'misses'} at full price` : `+${last.bonus} · nothing lost`
        });
    }
    return callouts;
};

export const derivePurchaseCallouts = (
    previous: RunState['storePurchases'] | undefined,
    next: RunState['storePurchases'] | undefined
): ScreenCallout[] => {
    const callouts: ScreenCallout[] = [];
    for (const item of STORE_ITEMS) {
        const was = previous?.[item.id as StoreItemId] ?? 0;
        const now = next?.[item.id as StoreItemId] ?? 0;
        for (let count = was + 1; count <= now; count += 1) {
            callouts.push({
                key: `bought:${item.id}:${count}`,
                kind: 'bought',
                size: 'minor',
                tone: 'gold',
                title: item.title.toUpperCase(),
                sub: item.kind === 'relic' ? 'Relic · kept to the end of the run' : 'Bought'
            });
        }
    }
    return callouts;
};

/** The tone a stage stamps in, exported for the queue's tests. */
export const stageTone = (stage: Exclude<ComboHeatStage, 'cold' | 'warm'>): ScreenCalloutTone => stage;

const comboHeatStageIndexOf = (stage: ComboHeatStage): number => ['cold', 'warm', 'hot', 'blazing', 'inferno', 'legendary'].indexOf(stage);
