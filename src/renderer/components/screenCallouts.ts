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
import type { RealmEvent, RealmId, RealmSeverity } from '../../shared/contracts';
import { REALMS, REALM_SEVERITIES, realmIntervalFor, realmWeatherClockRuns } from '../../shared/realm-rules';

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
export type ScreenCalloutKind = 'rank' | 'milestone' | 'temper' | 'broken' | 'last' | 'miss' | 'banked' | 'pickup' | 'bought' | 'ignite' | 'zone' | 'realm';
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

const ORDER: readonly ScreenCalloutKind[] = ['realm', 'ignite', 'zone', 'milestone', 'rank', 'temper', 'broken', 'last', 'banked', 'pickup', 'miss', 'bought'];

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
/** What a realm event is stamped as: the weather's word, and what it did in a line. */
const REALM_EVENT_STAMPS: Readonly<Record<Exclude<RealmEvent['kind'], 'reaction'>, { title: string; sub: (event: RealmEvent) => string; size: 'major' | 'minor' }>> = {
    blizzard: { title: 'BLIZZARD!', sub: (e) => `A row slides with the wind · ${e.tileIds.length} cards snowed over`, size: 'major' },
    frostbite: { title: 'FROSTBITE', sub: () => 'Both cards frozen: wait out the ice', size: 'minor' },
    wildfire: { title: 'WILDFIRE!', sub: () => 'A card is burning: match it before the fuse runs out', size: 'major' },
    burnout: { title: 'BURNT OUT', sub: (e) => `${Math.abs(e.gold ?? 0)} gold lost · the fire spreads`, size: 'minor' },
    doused: { title: 'DOUSED!', sub: (e) => `+${e.gold ?? 0} gold`, size: 'minor' },
    current: { title: 'THE TIDE TURNS', sub: (e) => `A column runs down a step · ${e.tileIds.length} cards moved`, size: 'major' },
    lightning: { title: 'LIGHTNING!', sub: () => 'Two cards swapped: they show where they landed', size: 'major' },
    overgrowth: { title: 'OVERGROWTH', sub: (e) => `Vines take ${e.tileIds.length === 1 ? 'a card' : `${e.tileIds.length} cards`}: match beside them to cut`, size: 'major' },
    harvest: { title: 'HARVEST!', sub: (e) => `${e.tileIds.length} ${e.tileIds.length === 1 ? 'vine' : 'vines'} cut · +${e.gold ?? 0} gold`, size: 'minor' },
    thaw: { title: 'THE HOLD BREAKS', sub: (e) => `${e.tileIds.length} ${e.tileIds.length === 1 ? 'card' : 'cards'} free again`, size: 'minor' },
    whiteout: { title: 'WHITEOUT!', sub: () => 'Every back is snowed over: play from memory', size: 'major' },
    firestorm: { title: 'FIRESTORM!', sub: (e) => `${e.tileIds.length} cards burning: douse what you can`, size: 'major' },
    springtide: { title: 'SPRING TIDE!', sub: (e) => `Two columns run · ${e.tileIds.length} cards moved`, size: 'major' },
    thunderclap: { title: 'THUNDERCLAP!', sub: (e) => `A row lit: ${e.tileIds.length} faces until your next flip`, size: 'major' },
    scald: { title: 'SCALDED!', sub: (e) => `The realm strikes back: ${e.tileIds.length === 1 ? 'a card you missed is' : 'both cards you missed are'} burning, two turns to douse`, size: 'major' },
    undertow: { title: 'UNDERTOW!', sub: () => 'The realm strikes back: the cards you missed are dragged a step down', size: 'major' },
    static: { title: 'STATIC!', sub: () => 'The realm strikes back: the cards you missed are thrown across the board', size: 'major' },
    snare: { title: 'SNARED!', sub: () => 'The realm strikes back: the cards you missed are held in vines', size: 'major' },
    scorch: { title: 'FIRE!', sub: () => 'Your fire burns the ice and vines around it away', size: 'minor' },
    wash: { title: 'WATER!', sub: () => 'Your water puts out fires and washes the cards around it along', size: 'minor' },
    freeze: { title: 'FROST!', sub: () => 'Your frost freezes the cards around it', size: 'minor' },
    entangle: { title: 'GROVE!', sub: () => 'Your grove snares the cards around it in vines', size: 'minor' },
    empowered: { title: 'CHARGED!', sub: (e) => `${e.tileIds.length === 1 ? 'A card drinks' : `${e.tileIds.length} cards drink`} its own element · a charge each, resonance when matched`, size: 'minor' },
    steam: { title: 'STEAM!', sub: (e) => `Fire meets water ×${e.potency ?? 1} · ${Math.max(0, e.tileIds.length - 2)} faces show until your next flip`, size: 'major' },
    blaze: { title: 'BLAZE!', sub: (e) => `Fire meets grove ×${e.potency ?? 1} · every vine burns · +${e.gold ?? 0} gold`, size: 'major' },
    melt: { title: 'THAW!', sub: (e) => `Fire meets frost ×${e.potency ?? 1} · all ice and snow gone · +${25 * (e.potency ?? 1) ** 2} score`, size: 'major' },
    freezeover: { title: 'FREEZE-OVER!', sub: (e) => `Water meets frost ×${e.potency ?? 1} · the floor holds still for ${(e.potency ?? 1) + 1} turns`, size: 'major' },
    flood: { title: 'FLOOD!', sub: (e) => `Water meets grove ×${e.potency ?? 1} · both gain ${e.potency ?? 1} resonance`, size: 'major' },
    frostbloom: { title: 'FROSTBLOOM!', sub: (e) => `Frost meets grove ×${e.potency ?? 1} · ${Math.max(0, e.tileIds.length - 2)} cards charged`, size: 'major' },
    neutralized: { title: 'NEUTRALIZED!', sub: (e) => `${e.tileIds.length === 1 ? 'A card puts' : `${e.tileIds.length} cards put`} the element out: nothing lands`, size: 'minor' },
    released: { title: 'RELEASED!', sub: (e) => `The element they drank pays out · +${e.gold ?? 0} gold`, size: 'minor' },
    bloom: { title: 'BLOOM!', sub: (e) => `${e.tileIds.length} ${e.tileIds.length === 1 ? 'bloom' : 'blooms'}: three gold for every one you cut`, size: 'major' }
};

/** The realm whose colour each element cast wears (`element-group-rules.ts`). */
const ELEMENT_CAST_REALM: Partial<Record<RealmEvent['kind'], keyof typeof REALMS>> = { scorch: 'ember', wash: 'tide', freeze: 'frost', entangle: 'grove' };

/** The stamp for a realm event (`realm-weather-rules.ts`), in the realm's colour. */
export const realmEventCallout = (event: RealmEvent, realmColor: string): ScreenCallout => {
    if (event.kind === 'reaction' && event.to) {
        const to = REALMS[event.to];
        return {
            key: `realm:${event.key}`,
            kind: 'realm',
            size: 'major',
            tone: 'legendary',
            title: `${(event.reaction ?? 'Reaction').toUpperCase()}!`,
            sub: `Your matches tip the floor into ${to.title}`,
            color: to.color
        };
    }
    const stamp = REALM_EVENT_STAMPS[event.kind as Exclude<RealmEvent['kind'], 'reaction'>];
    // An element's cast wears its own element's colour, not the floor's.
    const elementRealm = ELEMENT_CAST_REALM[event.kind];
    const color = elementRealm ? REALMS[elementRealm].color : realmColor;
    return {
        key: `realm:${event.key}`,
        kind: 'realm',
        size: stamp.size,
        tone: (event.gold ?? 0) < 0 ? 'miss' : (event.gold ?? 0) > 0 ? 'gold' : 'cyan',
        title: stamp.title,
        sub: event.ground?.detail ?? stamp.sub(event),
        color
    };
};

/** The stamp a floor opens on: where it is, and how hard the weather blows. */
export const realmEntryCallout = (
    key: string,
    realm: keyof typeof REALMS,
    severity: keyof typeof REALM_SEVERITIES,
    secondary: RealmId | null = null
): ScreenCallout => ({
    key: `realm-enter:${key}`,
    kind: 'realm',
    size: 'major',
    tone: 'legendary',
    title: secondary ? 'CONFLUENCE!' : REALMS[realm].place.toUpperCase(),
    sub: secondary
        ? `${REALMS[realm].title} meets ${REALMS[secondary].title} · double gold`
        : realmWeatherClockRuns(severity)
          ? `${REALM_SEVERITIES[severity].title} · ${REALMS[realm].weather} every ${realmIntervalFor(realm, severity)} turns`
          : `${REALM_SEVERITIES[severity].title} · your matches cast the elements`,
    color: REALMS[realm].color
});

/** What the realm stamps are derived from: where the floor is, and the realm's last event. */
export interface RealmCalloutSnapshot {
    runSeed: number;
    level: number;
    realm: RealmId | null;
    severity: RealmSeverity;
    secondary: RealmId | null;
    playing: boolean;
    event: RealmEvent | null;
    castEvent?: RealmEvent | null;
}

/**
 * The realm stamps between two reads: the floor arriving in a realm (once per floor, as play
 * starts) and every realm event the turn reported. The first read is the baseline.
 */
export const deriveRealmCallouts = (previous: RealmCalloutSnapshot, next: RealmCalloutSnapshot): ScreenCallout[] => {
    if (!next.realm) return [];
    const callouts: ScreenCallout[] = [];
    const arrived = previous.runSeed !== next.runSeed || previous.level !== next.level || !previous.playing;
    if (next.playing && arrived) {
        callouts.push(realmEntryCallout(`${next.runSeed}:${next.level}`, next.realm, next.severity, next.secondary));
    }
    if (next.event && next.event.key !== previous.event?.key) {
        callouts.push(realmEventCallout(next.event, REALMS[next.realm].color));
    }
    if (next.castEvent && next.castEvent.key !== previous.castEvent?.key && next.castEvent.key !== next.event?.key) {
        callouts.push(realmEventCallout(next.castEvent, REALMS[next.realm].color));
    }
    return callouts;
};

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
