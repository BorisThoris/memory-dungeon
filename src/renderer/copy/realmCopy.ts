import type { RealmDoor, RealmId, RealmSeverity } from '../../shared/contracts';
import { REALMS, REALM_SEVERITIES, realmIntervalFor } from '../../shared/realm-rules';

/** The realm chip in the HUD (`RunShell`): where the floor is, and the turns until its weather. */
export const REALM_HUD_COPY = {
    name: (realm: RealmId, severity: RealmSeverity): string => `${REALMS[realm].title} · ${REALM_SEVERITIES[severity].title}`,
    clock: (realm: RealmId, turnsLeft: number): string =>
        turnsLeft <= 1 ? `${REALMS[realm].weather} next turn` : `${REALMS[realm].weather} in ${turnsLeft}`,
    aria: (realm: RealmId, severity: RealmSeverity, turnsLeft: number): string =>
        `${REALMS[realm].place}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. ${REALMS[realm].weather} in ${turnsLeft} ${turnsLeft === 1 ? 'turn' : 'turns'}.`
} as const;

/** The travel screen (`RealmTravel`): the doors at a floor clear. */
export const REALM_TRAVEL_COPY = {
    title: 'Where now?',
    subtitle: 'Three ways down. Harder weather pays more gold at the clear.',
    doorKicker: (door: RealmDoor, endedIn: RealmId | null): string =>
        door.realmId === endedIn ? 'The way you came' : REALMS[door.realmId].title,
    severityLine: (door: RealmDoor): string => {
        const severity = REALM_SEVERITIES[door.severity];
        return `${severity.title} · ×${severity.goldMultiplier} gold`;
    },
    weatherLine: (door: RealmDoor): string =>
        `${REALMS[door.realmId].weather} every ${realmIntervalFor(door.realmId, door.severity)} turns`,
    choose: (door: RealmDoor): string => `Go to ${REALMS[door.realmId].place}, ${REALM_SEVERITIES[door.severity].title.toLowerCase()}`
} as const;
