import type { LevelResult, RealmDoor, RealmId, RealmSeverity, RunState } from '../../shared/contracts';
import { ATTUNEMENT_GOLD_STEP, SMOKE_STUDY_CUT_PER_BURNOUT } from '../../shared/realm-carryover-rules';
import { CONFLUENCE_GOLD_MULTIPLIER, REALMS, REALM_SEVERITIES, realmIntervalFor } from '../../shared/realm-rules';

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
    aria: (realm: RealmId, severity: RealmSeverity, weather: string, turnsLeft: number, secondary: RealmId | null = null): string =>
        `${REALMS[realm].place}${secondary ? ` meeting ${REALMS[secondary].place}` : ''}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. ${weather} in ${turnsLeft} ${turnsLeft === 1 ? 'turn' : 'turns'}.`
} as const;

const NUMERALS = ['', 'I', 'II', 'III'] as const;
export const attunementNumeral = (level: number): string => NUMERALS[Math.max(0, Math.min(3, Math.floor(level)))] ?? '';

/** The floor-clear beat's lines for what a realm floor sends on (`realm-carryover-rules.ts`). */
export const realmCarryoverLines = (
    result: LevelResult | null,
    attunement: RunState['realmAttunement']
): string[] => {
    if (!result?.realmId) return [];
    const lines: string[] = [];
    if (result.realmAttuned) {
        const level = attunement?.[result.realmAttuned] ?? 1;
        lines.push(`Attuned to ${REALMS[result.realmAttuned].title} ${attunementNumeral(level)}: its clears pay +${Math.round(level * ATTUNEMENT_GOLD_STEP * 100)}% gold`);
    }
    if (result.realmSmoke) {
        lines.push(`Smoke follows you: the next study is ${Math.round(result.realmSmoke * SMOKE_STUDY_CUT_PER_BURNOUT * 100)}% shorter`);
    }
    if (result.realmChill) {
        lines.push(`The cold comes with you: ${result.realmChill} cards start the next floor frozen`);
    }
    return lines;
};

/** The travel screen (`RealmTravel`): the doors at a floor clear. */
export const REALM_TRAVEL_COPY = {
    title: 'Where now?',
    subtitle: 'Three ways down. Harder weather pays more gold at the clear.',
    doorKicker: (door: RealmDoor, endedIn: RealmId | null): string =>
        door.realmId === endedIn ? 'The way you came' : REALMS[door.realmId].title,
    severityLine: (door: RealmDoor): string => {
        const severity = REALM_SEVERITIES[door.severity];
        return door.confluence
            ? `Confluence · ×${CONFLUENCE_GOLD_MULTIPLIER} gold`
            : `${severity.title} · ×${severity.goldMultiplier} gold`;
    },
    attunedLine: (level: number): string | null =>
        level > 0 ? `Attuned ${attunementNumeral(level)} · +${Math.round(level * ATTUNEMENT_GOLD_STEP * 100)}% gold` : null,
    placeLine: (door: RealmDoor): string =>
        door.confluence ? `${REALMS[door.realmId].place} meets ${REALMS[door.confluence].place.replace(/^The /, 'the ')}` : REALMS[door.realmId].place,
    confluenceRule: (door: RealmDoor): string | null =>
        door.confluence ? `Both realms' weather, one after the other, and both answer your turns.` : null,
    weatherLine: (door: RealmDoor): string =>
        door.confluence
            ? `${REALMS[door.realmId].weather} and ${REALMS[door.confluence].weather.toLowerCase()} by turns, every ${realmIntervalFor(door.realmId, door.severity)} turns`
            : `${REALMS[door.realmId].weather} every ${realmIntervalFor(door.realmId, door.severity)} turns · ${REALMS[door.realmId].peak} every third`,
    choose: (door: RealmDoor): string =>
        door.confluence
            ? `Go to the confluence of ${REALMS[door.realmId].place} and ${REALMS[door.confluence].place}`
            : `Go to ${REALMS[door.realmId].place}, ${REALM_SEVERITIES[door.severity].title.toLowerCase()}`
} as const;
