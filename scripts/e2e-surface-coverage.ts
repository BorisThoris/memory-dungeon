/**
 * Surfaces a player can reach that no end-to-end test ever visits.
 *
 * The vendor opened from the board was one of these. It is a different screen from the floor-clear
 * vendor — its own exit, its own copy, its own layout — and every shop fixture arrived from the
 * floor summary, so nothing rendered it. It shipped with two buttons that ran the same action and,
 * on the Steam Deck panel, a buy button clipped out of its card. Both were found the day a fixture
 * reached it.
 *
 * A fixture that exists but no spec names is the same failure one step earlier: the surface is
 * declared reachable and still nothing looks at it.
 */
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAYABLE_PATH_FIXTURE_IDS, createPlayablePathFixture } from '../src/shared/playable-path-fixtures';
import type { ViewState } from '../src/shared/contracts';

/** Fixtures no spec needs to name, by id with the reason. */
export const UNVISITED_FIXTURE_EXEMPTIONS: Record<string, string> = {
    freshProfile:
        'The empty save every visual spec already boots from via buildVisualSaveJson; the fixture id itself is for manual QA.'
};

/** Views no fixture has to reach, by name with the reason. */
export const UNREACHED_VIEW_EXEMPTIONS: Record<ViewState, string> | Record<string, string> = {
    boot: 'A frame before hydration finishes, not a screen a player acts on.',
    menu: 'Every visual and gate spec starts here; it needs no fixture of its own.',
    settings: 'Reached by navigation in the reachability gate and the fit contract, not by a fixture.',
    modeSelect: 'Choose Your Path, reached by pressing Play in the gate and the fit contract.',
    collection: 'Reached by navigation from the menu in both gates.',
    profile: 'Reached by navigation from the menu in both gates.',
    inventory: 'Reached by navigation from the menu and from the run menu.',
    codex: 'Reached by navigation from the menu and from the run menu.'
};

const readE2eSources = (): string =>
    globSync('e2e/**/*.ts')
        .map((file) => readFileSync(file, 'utf8'))
        .join('\n');

/** Fixture ids that exist and that no spec names. */
export const findUnvisitedFixtures = (sources: string): string[] =>
    PLAYABLE_PATH_FIXTURE_IDS.filter(
        (id) => !new RegExp(`['"\`]${id}['"\`]`, 'u').test(sources) && UNVISITED_FIXTURE_EXEMPTIONS[id] === undefined
    );

/** Views that no fixture puts the app into, so only navigation could reach them. */
export const findViewsNoFixtureReaches = (): string[] => {
    const reached = new Set(PLAYABLE_PATH_FIXTURE_IDS.map((id) => createPlayablePathFixture(id).view));
    const all: ViewState[] = [
        'boot',
        'menu',
        'settings',
        'playing',
        'gameOver',
        'modeSelect',
        'collection',
        'profile',
        'inventory',
        'shop',
        'sideRoom',
        'codex'
    ];
    return all.filter((view) => !reached.has(view) && UNREACHED_VIEW_EXEMPTIONS[view] === undefined);
};

/**
 * Distinct surfaces, not views.
 *
 * This is the correction the in-floor vendor forced. A view-level census said `shop` was covered,
 * because the floor-clear vendor reached it — and the vendor opened from the board, a different
 * screen with its own exit and its own layout, was invisible to the count. Two states of one view
 * that render differently are two surfaces, and each one needs a fixture that lands on it.
 */
export interface DeclaredSurface {
    readonly key: string;
    readonly fixtureId: (typeof PLAYABLE_PATH_FIXTURE_IDS)[number];
    /** What makes this surface different from the others sharing its view. */
    readonly holds: (state: ReturnType<typeof createPlayablePathFixture>) => boolean;
}

export const DECLARED_SURFACES: readonly DeclaredSurface[] = [
    {
        key: 'shop opened from the floor summary',
        fixtureId: 'floorClearWithShop',
        holds: (state) => state.view === 'playing' || state.shopReturnMode === 'summary'
    },
    {
        key: 'shop opened from the board mid-floor',
        fixtureId: 'inFloorShop',
        holds: (state) => state.view === 'shop' && state.shopReturnMode === 'floor'
    },
    {
        key: 'a run that has ended',
        fixtureId: 'gameOver',
        holds: (state) => state.view === 'gameOver'
    },
    {
        key: 'a side room offering a choice',
        fixtureId: 'sideRoomChoice',
        holds: (state) => state.view === 'sideRoom'
    },
    {
        key: 'a floor cleared with routes to pick',
        fixtureId: 'floorClearWithRouteChoices',
        holds: (state) => state.run?.status === 'levelComplete'
    },
    {
        key: 'a relic draft mid-run',
        fixtureId: 'relicDraft',
        holds: (state) => state.run != null
    }
];

/** Declared surfaces whose fixture no longer lands on them. */
export const findBrokenSurfaces = (): string[] =>
    DECLARED_SURFACES.filter((surface) => !surface.holds(createPlayablePathFixture(surface.fixtureId))).map(
        (surface) => `${surface.key} (${surface.fixtureId})`
    );

/** Declared surfaces whose fixture no spec names. */
export const findUnvisitedSurfaces = (sources: string): string[] =>
    DECLARED_SURFACES.filter(
        (surface) => !new RegExp(`['"\`]${surface.fixtureId}['"\`]`, 'u').test(sources)
    ).map((surface) => `${surface.key} (${surface.fixtureId})`);

const main = (): void => {
    const sources = readE2eSources();
    const unvisited = findUnvisitedFixtures(sources);
    const unreached = findViewsNoFixtureReaches();
    const broken = findBrokenSurfaces();
    const unvisitedSurfaces = findUnvisitedSurfaces(sources);

    for (const id of unvisited) {
        console.log(`fixture no spec names: ${id}`);
    }
    for (const view of unreached) {
        console.log(`view no fixture reaches and no exemption explains: ${view}`);
    }
    for (const surface of broken) {
        console.log(`declared surface its fixture no longer lands on: ${surface}`);
    }
    for (const surface of unvisitedSurfaces) {
        console.log(`declared surface no spec visits: ${surface}`);
    }
    console.log(
        `\n${PLAYABLE_PATH_FIXTURE_IDS.length} fixtures, ${unvisited.length} named by no spec, ` +
            `${DECLARED_SURFACES.length} declared surfaces, ${broken.length} broken, ${unvisitedSurfaces.length} unvisited, ` +
            `${unreached.length} views unreached, ` +
            `${Object.keys(UNVISITED_FIXTURE_EXEMPTIONS).length + Object.keys(UNREACHED_VIEW_EXEMPTIONS).length} exempt by name`
    );
    if (unvisited.length > 0 || unreached.length > 0 || broken.length > 0 || unvisitedSurfaces.length > 0) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]).endsWith(resolve('scripts/e2e-surface-coverage.ts'))) {
    main();
}
