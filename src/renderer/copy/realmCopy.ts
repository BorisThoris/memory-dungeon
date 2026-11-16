import { plural, tr } from '../../shared/i18n';
import type { LevelResult, RealmDoor, RealmId, RealmSeverity, RunState } from '../../shared/contracts';
import { SMOKE_STUDY_CUT_PER_BURNOUT, attunementGoldBonus, realmBacklashRuns } from '../../shared/realm-carryover-rules';
import { CONFLUENCE_GOLD_MULTIPLIER, REALMS, REALM_SEVERITIES, realmIntervalFor, realmWeatherClockRuns } from '../../shared/realm-rules';
import type { DailyMusicMode, DailyMusicTimbre } from '../../shared/daily-music-composer';

const DAILY_MUSIC_KEY: Readonly<Record<DailyMusicMode, string>> = {
    aeolian: tr.s('A minor'),
    dorian: tr.s('A Dorian'),
    mixolydian: tr.s('A Mixolydian'),
    ionian: tr.s('A major'),
    harmonicMinor: tr.s('A harmonic minor')
};

const DAILY_MUSIC_VOICE: Readonly<Record<DailyMusicTimbre, string>> = {
    warm: tr.s('warm keys'),
    glass: tr.s('glass bells'),
    reed: tr.s('reeds'),
    wood: tr.s('marimba'),
    electric: tr.s('electric lead')
};

/**
 * The run details' music line (`RunShell`): the piece this realm plays today was written for this
 * player (`dailyMusic.ts`), and this is the one place that says so.
 */
export const DAILY_MUSIC_COPY = {
    credit: (piece: { bpm: number; mode: DailyMusicMode; timbre: DailyMusicTimbre }): string =>
        tr`Today's music · ${DAILY_MUSIC_KEY[piece.mode]} · ${piece.bpm} bpm · ${DAILY_MUSIC_VOICE[piece.timbre]}`,
    title: tr.s('Written for you today; a new piece tomorrow. Settings, Audio turns it off.')
} as const;

/** The realm chip in the HUD (`RunShell`): where the floor is, and the turns until its weather. */
export const REALM_HUD_COPY = {
    name: (realm: RealmId, severity: RealmSeverity, secondary: RealmId | null = null): string =>
        secondary
            ? `${REALMS[realm].title} + ${REALMS[secondary].title}`
            : `${REALMS[realm].title} · ${REALM_SEVERITIES[severity].title}`,
    /** The sway (`realm-sway-rules.ts`): the realm the player's matches are leaning the floor toward. */
    sway: (realm: RealmId, pairs: number, tip: number): string => tr`${REALMS[realm].title} rising ${pairs}/${tip}`,
    /** The next weather by name - the peak's own name when it is the peak. */
    clock: (weather: string, turnsLeft: number): string => (turnsLeft <= 1 ? tr`${weather} next turn` : tr`${weather} in ${turnsLeft}`),
    /** A calm or wild floor: no clock, the cards make the weather. */
    ariaNoClock: (realm: RealmId, severity: RealmSeverity, secondary: RealmId | null = null): string =>
        tr`${REALMS[realm].place}${secondary ? tr` meeting ${REALMS[secondary].place}` : ''}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. Your matches cast the elements.`,
    aria: (realm: RealmId, severity: RealmSeverity, weather: string, turnsLeft: number, secondary: RealmId | null = null): string =>
        tr`${REALMS[realm].place}${secondary ? tr` meeting ${REALMS[secondary].place}` : ''}, ${REALM_SEVERITIES[severity].title.toLowerCase()}. ${weather} in ${plural(turnsLeft, { one: '{0} turn', other: '{0} turns' })}.`
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
        lines.push(tr`Deeper into ${REALMS[result.realmAttuned].title}: depth ${attunementNumeral(level)}, its clears pay +${attunementGoldPercent(level)}% gold`);
    }
    if (result.realmSmoke) {
        lines.push(tr`Smoke follows you: the next study is ${Math.round(result.realmSmoke * SMOKE_STUDY_CUT_PER_BURNOUT * 100)}% shorter`);
    }
    if (result.realmChill) {
        lines.push(tr.s('The cold comes with you: at least two complete pairs start frozen if another pair can stay free'));
    }
    return lines;
};

/** The travel screen (`RealmTravel`): the doors at a floor clear. */
export const REALM_TRAVEL_COPY = {
    title: tr.s('Where now?'),
    subtitle: tr.s('Choose your next arena'),
    doorKicker: (door: RealmDoor, endedIn: RealmId | null): string =>
        door.realmId === endedIn ? tr.s('The way you came') : REALMS[door.realmId].title,
    severityLine: (door: RealmDoor): string => {
        const severity = REALM_SEVERITIES[door.severity];
        return door.confluence
            ? tr`Confluence · ×${CONFLUENCE_GOLD_MULTIPLIER} gold`
            : tr`${severity.title} · ×${severity.goldMultiplier} gold`;
    },
    attunedLine: (level: number): string | null =>
        level > 0 ? tr`Depth ${attunementNumeral(level)} · +${attunementGoldPercent(level)}% gold` : null,
    /** What going deeper behind this door costs: the realm bites back at misses sooner. */
    depthWarning: (door: RealmDoor, level: number): string | null =>
        door.severity !== 'raging' && realmBacklashRuns(door.severity, level) ? tr.s('Misses trigger hazards') : null,
    placeLine: (door: RealmDoor): string =>
        door.confluence ? tr`${REALMS[door.realmId].place} meets ${REALMS[door.confluence].place.replace(/^The /, 'the ')}` : REALMS[door.realmId].place,
    confluenceRule: (door: RealmDoor): string | null =>
        door.confluence ? tr`Both realms' weather, one after the other, and both answer your turns.` : null,
    weatherLine: (door: RealmDoor): string =>
        !realmWeatherClockRuns(door.severity)
            ? tr.s('No timed hazards')
            : door.confluence
            ? tr`${REALMS[door.realmId].weather} / ${REALMS[door.confluence].weather} · every ${realmIntervalFor(door.realmId, door.severity)} turns`
            : tr`${REALMS[door.realmId].weather} · every ${realmIntervalFor(door.realmId, door.severity)} turns`,
    risk: (door: RealmDoor, level: number): string | null => {
        if (!realmWeatherClockRuns(door.severity) && !realmBacklashRuns(door.severity, level)) return null;
        const risks: Record<RealmId, string> = {
            ember: tr.s('Fires spread and burn gold. Match to douse.'),
            tide: tr.s('Currents move columns.'), frost: tr.s('Freezes groups; snow hides elements.'),
            grove: tr.s('Vines hold groups. Match beside them to cut.'), storm: tr.s('Lightning swaps and reveals cards.')
        };
        return risks[door.realmId] + (door.confluence ? ` ${risks[door.confluence]}` : '');
    },
    choose: (door: RealmDoor): string =>
        door.confluence
            ? tr`Go to the confluence of ${REALMS[door.realmId].place} and ${REALMS[door.confluence].place}`
            : tr`Go to ${REALMS[door.realmId].place}, ${REALM_SEVERITIES[door.severity].title.toLowerCase()}`
} as const;

/** The floor journey's rewards row, as a screen reader names it. */
export const FLOOR_JOURNEY_REWARDS_LABEL = tr.s('Rewards earned on this floor');

/** Dread on the run bar (`dread-rules.ts`): the tier, the next one's name, and what a screen reader hears. */
export const DREAD_HUD_COPY = {
    title: tr.s('Dread: how bad the dungeon has become. It rises with every floor, faster in wild and raging realms, and never falls.'),
    // A numeral, not digits: the tier sits inside the floor reading, whose number is the only digit there.
    beyond: (beyond: number): string => (beyond > 0 ? ` ${attunementNumeral(beyond + 1)}` : ''),
    results: (tier: string, beyond: number): string => tr`Dread: ${tier}${beyond > 0 ? ` ${attunementNumeral(beyond + 1)}` : ''}`,
    aria: (tier: string, next: string, fraction: number, beyond: number): string =>
        beyond > 0 || tier === next
            ? tr`Dread: ${tier}, deeper still`
            : tr`Dread: ${tier}, ${Math.round(fraction * 100)} percent of the way to ${next}`
} as const;

/** The next milestone on the run bar (`milestone-rules.ts`, DGE-004). */
export const MILESTONE_HUD_COPY = {
    title: tr.s('The next milestone: the end of this act of the Descent, and how much of the act is behind you.'),
    name: (name: string): string => tr`Next: ${name}`,
    fraction: (done: number, total: number): string => tr`${done} of ${total}`,
    aria: (name: string, done: number, total: number): string => tr`Next milestone: ${name}, floor ${done} of ${total}`,
    // Endless's rent (`endless-rent-rules.ts`): a score bar, never a clock.
    rentName: tr.s('Rent'),
    rentTitle: tr.s('Endless rent: the score this floor must pay by its clear, the clear bonus included. A floor that pays less ends the run.'),
    rentFraction: (paid: number, rent: number): string => tr`${Math.min(paid, rent).toLocaleString('en-US')} of ${rent.toLocaleString('en-US')}`,
    rentAria: (paid: number, rent: number): string =>
        paid >= rent ? tr`Rent paid: ${rent.toLocaleString('en-US')}` : tr`Rent: ${paid.toLocaleString('en-US')} of ${rent.toLocaleString('en-US')} paid`
} as const;
