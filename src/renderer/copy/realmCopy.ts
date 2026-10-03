import type { LevelResult, RealmDoor, RealmId, RealmSeverity, RunState } from '../../shared/contracts';
import { SMOKE_STUDY_CUT_PER_BURNOUT, attunementGoldBonus, realmBacklashRuns } from '../../shared/realm-carryover-rules';
import { CONFLUENCE_GOLD_MULTIPLIER, REALMS, REALM_SEVERITIES, realmIntervalFor, realmWeatherClockRuns } from '../../shared/realm-rules';

/** The realm chip in the HUD (`RunShell`): where the floor is, and the turns until its weather. */
export const REALM_HUD_COPY = {
    name: (realm: RealmId, severity: RealmSeverity, secondary: RealmId | null = null): string =>
        secondary
            ? `${REALMS[realm].title} + ${REALMS[secondary].title}`
            : `${REALMS[realm].title} · ${REALM_SEVERITIES[severity].title}`,
    /** The sway (`realm-sway-rules.ts`): the realm the player's matches are leaning the floor toward. */
    sway: (realm: RealmId, pairs: number, tip: number): string => `${REALMS[realm].title} rising ${pairs}/${tip}`,
    /** The next weather by name - the peak's own name when it is the peak. */
    clock: (weather: string, turnsLeft: number): string => (turnsLeft <= 1 ? `${weather} next turn` : `${weather} in ${turnsLeft}`),
    /** A calm or wild floor: no clock, the cards make the weather. */
    ariaNoClock: (realm: RealmId, severity: RealmSeverity, secondary: RealmId | null = null): string =>
        `${REALMS[realm].place}${secondary ? ` meeting ${REALMS[secondary].place}` : ''}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. Your matches cast the elements.`,
    aria: (realm: RealmId, severity: RealmSeverity, weather: string, turnsLeft: number, secondary: RealmId | null = null): string =>
        `${REALMS[realm].place}${secondary ? ` meeting ${REALMS[secondary].place}` : ''}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. ${weather} in ${turnsLeft} ${turnsLeft === 1 ? 'turn' : 'turns'}.`
} as const;

const ROMAN: readonly [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
/** The depth as a numeral: attunement has no cap, so neither has this. */
export const attunementNumeral = (level: number): string => {
    let left = Math.max(0, Math.floor(level));
    let out = '';
    for (const [value, glyph] of ROMAN) {
        while (left >= value) {
            out += glyph;
            left -= value;
        }
    }
    return out;
};
const attunementGoldPercent = (level: number): number => Math.round(attunementGoldBonus(level) * 100);

/** The floor-clear beat's lines for what a realm floor sends on (`realm-carryover-rules.ts`). */
export const realmCarryoverLines = (
    result: LevelResult | null,
    attunement: RunState['realmAttunement']
): string[] => {
    if (!result?.realmId) return [];
    const lines: string[] = [];
    if (result.realmAttuned) {
        const level = attunement?.[result.realmAttuned] ?? 1;
        lines.push(`Deeper into ${REALMS[result.realmAttuned].title}: depth ${attunementNumeral(level)}, its clears pay +${attunementGoldPercent(level)}% gold`);
    }
    if (result.realmSmoke) {
        lines.push(`Smoke follows you: the next study is ${Math.round(result.realmSmoke * SMOKE_STUDY_CUT_PER_BURNOUT * 100)}% shorter`);
    }
    if (result.realmChill) {
        lines.push('The cold comes with you: at least two complete pairs start frozen if another pair can stay free');
    }
    return lines;
};

/** The travel screen (`RealmTravel`): the doors at a floor clear. */
export const REALM_TRAVEL_COPY = {
    title: 'Where now?',
    subtitle: 'Choose your next arena',
    doorKicker: (door: RealmDoor, endedIn: RealmId | null): string =>
        door.realmId === endedIn ? 'The way you came' : REALMS[door.realmId].title,
    severityLine: (door: RealmDoor): string => {
        const severity = REALM_SEVERITIES[door.severity];
        return door.confluence
            ? `Confluence · ×${CONFLUENCE_GOLD_MULTIPLIER} gold`
            : `${severity.title} · ×${severity.goldMultiplier} gold`;
    },
    attunedLine: (level: number): string | null =>
        level > 0 ? `Depth ${attunementNumeral(level)} · +${attunementGoldPercent(level)}% gold` : null,
    /** What going deeper behind this door costs: the realm bites back at misses sooner. */
    depthWarning: (door: RealmDoor, level: number): string | null =>
        door.severity !== 'raging' && realmBacklashRuns(door.severity, level) ? 'Misses trigger hazards' : null,
    placeLine: (door: RealmDoor): string =>
        door.confluence ? `${REALMS[door.realmId].place} meets ${REALMS[door.confluence].place.replace(/^The /, 'the ')}` : REALMS[door.realmId].place,
    confluenceRule: (door: RealmDoor): string | null =>
        door.confluence ? `Both realms' weather, one after the other, and both answer your turns.` : null,
    weatherLine: (door: RealmDoor): string =>
        !realmWeatherClockRuns(door.severity)
            ? 'No timed hazards'
            : door.confluence
            ? `${REALMS[door.realmId].weather} / ${REALMS[door.confluence].weather} · every ${realmIntervalFor(door.realmId, door.severity)} turns`
            : `${REALMS[door.realmId].weather} · every ${realmIntervalFor(door.realmId, door.severity)} turns`,
    risk: (door: RealmDoor, level: number): string | null => {
        if (!realmWeatherClockRuns(door.severity) && !realmBacklashRuns(door.severity, level)) return null;
        const risks: Record<RealmId, string> = {
            ember: 'Fires spread and burn gold. Match to douse.',
            tide: 'Currents move columns.', frost: 'Freezes groups; snow hides elements.',
            grove: 'Vines hold groups. Match beside them to cut.', storm: 'Lightning swaps and reveals cards.'
        };
        return risks[door.realmId] + (door.confluence ? ` ${risks[door.confluence]}` : '');
    },
    choose: (door: RealmDoor): string =>
        door.confluence
            ? `Go to the confluence of ${REALMS[door.realmId].place} and ${REALMS[door.confluence].place}`
            : `Go to ${REALMS[door.realmId].place}, ${REALM_SEVERITIES[door.severity].title.toLowerCase()}`
} as const;
