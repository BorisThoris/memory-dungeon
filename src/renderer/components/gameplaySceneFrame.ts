import type { ChainTier } from '../../shared/chain-tier-rules';
import type { SceneEffectTier } from '../../shared/graphicsQuality';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES, type AmbientCellName } from '../assets/ui/sprites';
import { ELEMENT_SCENE_SUITS, type ElementSceneState } from './elementScene';
import { ELEMENT_SCENE_ART } from './elementSceneArt';
import { REALM_ROOM_ART } from './realmRoomArt';
import { REALM_FLOORS, realmLayerLevel, realmRoomLifeDraws, realmRoomSpriteDraws, realmRoomWarpDraws } from './realmRoomLife';
import { roomSpillDraws, type RoomSpill } from './roomSpill';
import { comboSoftCap } from '../../shared/combo-heat-rules';
import { ELEMENT_SCENE_VISUALS } from './elementScene';
import { buildEmberDrift, emberMoteCount, EMBER_VIEWBOX } from './emberDrift';
import { buildGoldRain, floorScale, goldCoinPath, goldCoinPose, goldCoinView, GOLD_COIN_RADIUS, GOLD_PILE_MAX_COINS, GOLD_PILE_SLOTS, GOLD_RAIN_FLOOR, GOLD_RAIN_MAX_COINS, type GoldCoin, type GoldCoinPath, type GoldFloorBand } from './goldRain';
import { sceneFlameLevels, sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import { ambientSprite, crossingDraws, dripDraws, driftDraws, flameDraws, flameEmberDraws, fogDraw, glintDraws, moteDraws, SCENE_PLATE_ASPECT, sceneKeyframes } from './sceneAmbient';
import { sceneBeatEnvelope, sceneBreath, sceneFlicker, sceneHash, sceneOccurrence, sceneSmoothstep, type SceneClock } from './sceneClock';
import type { SceneMood, SceneDriftTone } from './sceneMood';
import type { SceneBlend, SceneDraw, SceneFilter, SceneImageDraw } from './scenePaint';
import { ringMotes } from './sceneSpriteClocks';
import { buildStormBolts, STORM_VIEWBOX } from './stormBolts';

/**
 * One frame of the gameplay room (`GameplayScene`).
 *
 * The room is a dark *base* and additive layers, each a family of light (`scripts/scene-pipeline/`),
 * and the run sets how strongly each shows. This function is that mapping, from the run to a list
 * of draws, where it used to be forty rules of CSS driving twenty blended elements:
 *
 *   - the ring follows the chain meter's fill and the combo heat past it (`sceneRingLevels`): its
 *     floor light and its glow rise, the glow turns toward rose, it throws up motes and its runes
 *     glint; it breathes while the board is memorised, flashes on a break, swells on a clear;
 *   - the torches always burn, harder the better the run is going (`sceneFlameLevels`), flare on a
 *     break, gutter on a miss and on a clear, and burn low in peril;
 *   - the room itself changes with the run (`sceneMood.ts`): the shop and the void crossfade over
 *     the dungeon, snow settles, stone runs wet, frost grows in, a storm flashes, chemistry
 *     repaints the walls with lightning down through the arches, gold rains on a payout, and the
 *     red edge of peril breathes while the bank is empty;
 *   - and the place is lived in: mist in the corridor, dust in the torchlight, water dripping off
 *     the vault, smoke off the big torches, a bat in the far passage, eyes in the dark, a spider
 *     on its thread.
 *
 * Every tier draws the same room. `lean` (a phone, low quality) thins the specks; `still`
 * (reduce motion) draws the lit painting with nothing moving and no flash.
 */
export interface GameplayFrameInput {
    fill: number;
    memorize: boolean;
    pulse: ChainTier | 'pop' | 'none';
    pulseKey: string | null;
    feverKey: string | null;
    cleared: boolean;
    imminent: boolean;
    comboHeat: number;
    /**
     * `comboDepth` of the run's combo: unbounded, rising with every link. What must keep climbing with
     * the chain (a realm room's glow and its life) reads this rather than the heat, which levels off.
     */
    comboDepth?: number;
    comboHueDeg: number;
    mood: SceneMood | undefined;
    runSeed: number;
    tier: SceneEffectTier;
    /** Draw the smaller chemistry paintings (`prefersCompactSceneArt`): a phone. */
    compactArt?: boolean;
    /** How far the parent sinks the stone (`--scene-base-opacity`). */
    base: number;
    /** What breaking cards have spilled into the room (`roomSpill.ts`). */
    spills?: readonly RoomSpill[];
}

const flames = SCENE_SPRITES.gameplayFlames;

/** The rune ring on the floor (`scene.json`): centre and radii, fractions of the plate. */
export const SCENE_RING = { cx: 0.5, cy: 0.729, rx: 0.218, ry: 0.104 } as const;

const RING_GLINTS: ReadonlyArray<readonly [number, number]> = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * 2 * Math.PI + 0.26;
    return [SCENE_RING.cx + SCENE_RING.rx * 0.9 * Math.cos(angle), SCENE_RING.cy + SCENE_RING.ry * 0.9 * Math.sin(angle)] as const;
});

/** Where water comes off the vault: x, the stone it leaves, the floor it lands on. */
const DRIP_SPOTS: ReadonlyArray<readonly [number, number, number]> = [
    [0.415, 0.2, 0.655],
    [0.585, 0.23, 0.63],
    [0.3, 0.3, 0.82],
    [0.705, 0.31, 0.85]
];

/** The dark of the far passages, where something looks back. */
const EYE_SPOTS: ReadonlyArray<readonly [number, number]> = [
    [0.557, 0.468],
    [0.437, 0.497],
    [0.69, 0.462]
];

const GAMEPLAY_BAT_EVERY_MS = 41_000;
export const GAMEPLAY_EYES_EVERY_MS = 37_000;
export const GAMEPLAY_EYES_LAST_MS = 4_600;
export const GAMEPLAY_SPIDER_EVERY_MS = 53_000;
export const GAMEPLAY_SPIDER_LASTS_MS = 9_500;

/** How many bolts a storm throws: three, and more with the surge past Legendary. */
export const stormBoltCount = (surge: number): number => 3 + Math.min(6, Math.floor(Math.max(0, surge)));

/**
 * The weather's layouts are the same every frame until the run changes them, so each is laid out
 * once and kept: a frame asks for "the drift for this seed and count" thirty times a second.
 */
const keepLast = <Args extends readonly (string | number)[], Result>(build: (...args: Args) => Result): ((...args: Args) => Result) => {
    let lastKey: string | null = null;
    let last: Result;
    return (...args) => {
        const key = args.join('|');
        if (key !== lastKey) {
            lastKey = key;
            last = build(...args);
        }
        return last;
    };
};

const emberDriftFor = keepLast((seed: number, count: number) => buildEmberDrift(seed, count));
const stormBoltsFor = keepLast((seed: number, count: number) =>
    buildStormBolts(seed, count).map((bolt) => bolt.points.map(([x, y]) => [x / STORM_VIEWBOX.width, y / STORM_VIEWBOX.height] as const))
);
/** Each shower's coins, laid out once: a floor's pile is many showers, drawn every frame. */
const goldShowers = new Map<string, GoldCoin[]>();
const goldRainFor = (key: string, coins: number): GoldCoin[] => {
    const id = `${key}:${coins}`;
    let laid = goldShowers.get(id);
    if (!laid) {
        if (goldShowers.size > 64) goldShowers.clear();
        laid = buildGoldRain(key, coins);
        goldShowers.set(id, laid);
    }
    return laid;
};
const RING_MOTES = ringMotes();

const MATERIAL_LIGHT_HUE = { ember: 100, tide: -45, bone: -25, moss: -125 } as const;

const DRIFT_CELLS: Record<SceneDriftTone, { spark: AmbientCellName; ash: AmbientCellName }> = {
    ember: { spark: 'dotEmber', ash: 'dotCinder' },
    spore: { spark: 'dotFirefly', ash: 'dotSpore' },
    bubble: { spark: 'bubble', ash: 'dotCyan' }
};

/** The torches' painted light gutters: down, a little over, and back. */
const gutter = (elapsed: number, durationMs: number): number =>
    elapsed >= 0 && elapsed < durationMs
        ? sceneKeyframes(elapsed / durationMs, [
              [0, 1],
              [0.22, 0.61],
              [0.48, 1.16],
              [1, 1]
          ])
        : 1;

const hexToRgba = (hex: string, alpha: number): string => {
    const value = Number.parseInt(hex.replace('#', ''), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const elementDraws = (scene: ElementSceneState, plate: SceneMood['plate'], clock: SceneClock, compact: boolean): SceneDraw[] => {
    const { t, still } = clock;
    // In another room the chemistry is a tint on it, not the walls themselves.
    // A realm's own room is not the dungeon's layout either: its chemistry is laid over it like the shop's.
    const world = plate === 'void' ? 0.32 : plate === 'shop' || plate === 'realm' ? 0.2 : 1;
    const blend: SceneBlend = plate === 'void' ? 'screen' : plate === 'shop' || plate === 'realm' ? 'soft-light' : 'source-over';
    const draws: SceneDraw[] = [];
    const pulse = clock.since('element-pulse', scene.pulseKey);
    for (const reaction of scene.reactions) {
        const shown = clock.smooth(`element:${reaction.kind}`, reaction.opacity, 850);
        if (shown <= 0.004) {
            continue;
        }
        const art = ELEMENT_SCENE_ART[reaction.kind];
        draws.push({ kind: 'image', id: `element-${reaction.kind}`, src: compact ? art.mobile || art.desktop : art.desktop, alpha: shown * world, blend });
        // The energy in the room: three soft pools of the reaction's light, drifting, flaring on contact.
        const light = ELEMENT_SCENE_VISUALS[reaction.kind].light;
        const contact = scene.pulseKinds.includes(reaction.kind) ? sceneBeatEnvelope(pulse, 1000, 0.25) : 0;
        const flare = reaction.kind === 'blaze' && !still ? 0.1 + 0.12 * sceneBreath(t, 5600) : 0.13;
        const energy = reaction.weight * (flare + 0.23 * contact) * shown * world;
        const sway = still ? 0 : sceneBreath(t, reaction.kind === 'freezeover' ? 28_000 : reaction.kind === 'frostbloom' ? 24_000 : 18_000) * 2 - 1;
        const stops = [
            [0, hexToRgba(light, 1)],
            [1, hexToRgba(light, 0)]
        ] as const;
        draws.push({ kind: 'glow', id: `element-${reaction.kind}-energy-l`, alpha: energy, blend: 'screen', cx: 0.08 + 0.01 * sway, cy: 0.7 - 0.015 * sway, rx: 0.36, ry: 0.36, stops });
        draws.push({ kind: 'glow', id: `element-${reaction.kind}-energy-r`, alpha: energy, blend: 'screen', cx: 0.92 + 0.01 * sway, cy: 0.65 - 0.015 * sway, rx: 0.36, ry: 0.36, stops });
        draws.push({ kind: 'glow', id: `element-${reaction.kind}-energy-f`, alpha: energy, blend: 'screen', cx: 0.5 + 0.01 * sway, cy: 0.87 - 0.015 * sway, rx: 0.26, ry: 0.26, stops });
    }
    // Each element in the room tints the ring's floor light its own way.
    for (const suit of ELEMENT_SCENE_SUITS) {
        const level = clock.smooth(`material:${suit}`, scene.elements[suit] * 0.32, 700) * world;
        if (level > 0.004) {
            draws.push({ kind: 'image', id: `material-${suit}`, src: UI_ART.gameplaySceneLightRing, alpha: level, blend: 'screen', filter: { hueDeg: MATERIAL_LIGHT_HUE[suit], saturate: 1.35 } });
        }
    }
    return draws;
};


/** Where a coin starts, just above the plate, as a fraction of its height. */

/**
 * One coin of a shower, `seconds` after it started to fall: falling from rest under gravity onto
 * its spot on the floor, hopping once, resting, going out. It turns as it falls (the baked turn's
 * frames), slows on the hop and lies still; while it falls fast it is drawn out faintly behind
 * itself, the smear the eye sees, and when a face turns to the torches it catches the light in a glint.
 */
export interface GoldCoinPlace {
    /** The floor it lands on (the dungeon's by default). */
    band?: GoldFloorBand;
    /** Water: it splashes and sinks instead of bouncing. */
    water?: boolean;
    /** The room's clock, for the glints off the pile. */
    t?: number;
}

const COIN_TURN = SCENE_SPRITES.goldCoin.sprites[0];
/** The baked coin fills this much of its frame (`bake_coin.py`: R). */
const COIN_FILL = 0.86;

/** Each coin's flight, worked out once per floor it falls on. */
const coinPaths = new WeakMap<GoldCoin, Map<string, GoldCoinPath>>();
const coinPathFor = (coin: GoldCoin, band: GoldFloorBand): GoldCoinPath => {
    const key = `${band.far}:${band.near}:${band.horizon ?? ''}`;
    let byBand = coinPaths.get(coin);
    if (!byBand) {
        byBand = new Map();
        coinPaths.set(coin, byBand);
    }
    let path = byBand.get(key);
    if (!path) {
        path = goldCoinPath(coin, band);
        byBand.set(key, path);
    }
    return path;
};

/**
 * One coin `seconds` after it began to fall (`Infinity`: found lying there), as gold does
 * (`goldCoinPath`): tumbling down through the room, striking the stone and bouncing, spinning down
 * to lie flat in the floor's perspective, its shadow under it sharpening as it comes down. Drawn
 * from the baked 3D coin (`bake_coin.py`), the frame of its turn and its rotation taken from its
 * face against the camera, so its edge shows as it tumbles and its rim as it lies. On water it goes
 * in with a ring and sinks to a glint under the surface.
 */
export const goldCoinDraws = (coin: GoldCoin, index: number, seconds: number, lean: boolean, place: GoldCoinPlace = {}): SceneDraw[] => {
    if (seconds <= 0 || !COIN_TURN) {
        return [];
    }
    const band = place.band ?? GOLD_RAIN_FLOOR;
    const path = coinPathFor(coin, band);
    const water = place.water ?? false;
    const pose = goldCoinPose(path, water ? Math.min(seconds, path.landS) : seconds);
    const yFloor = band.near + (band.far - band.near) * pose.depth;
    const scale = floorScale(yFloor, band);
    const radius = GOLD_COIN_RADIUS * scale;
    const view = goldCoinView(pose, band);
    const frames = COIN_TURN.frames;
    const frame = Math.max(0, Math.min(frames - 1, Math.round(view.turn * (frames - 1))));
    const y = yFloor - pose.height * scale;
    const x = pose.x;
    const side = (2 * radius) / COIN_FILL;
    const draws: SceneDraw[] = [];
    const coinDraw = (alpha: number, dy = 0): SceneImageDraw => ({
        kind: 'image',
        id: `coin-${index}`,
        src: COIN_TURN.sheet,
        alpha,
        blend: 'source-over',
        // Centred on the coin: on the floor its centre is as high as its tilt stands it up.
        rect: { x: x - side / 2 / SCENE_PLATE_ASPECT, y: y + dy - side / 2, w: side / SCENE_PLATE_ASPECT, h: side },
        frame: { index: frame, count: frames },
        rotate: view.rotate,
        depth: 1
    });
    if (water && Number.isFinite(seconds) && seconds >= path.landS) {
        // Into the water: a ring spreads where it went in, two drops jump, and it sinks to a glint.
        const under = seconds - path.landS;
        if (under < 0.9) {
            draws.push(ambientSprite({ id: `coin-${index}-splash`, cell: 'ripple', x, y: yFloor, size: (0.012 + 0.05 * (under / 0.9)) * scale, alpha: 0.8 * (1 - under / 0.9) ** 1.5, scaleX: 2.6 }));
        }
        if (under < 0.4 && !lean) {
            const q = under / 0.4;
            for (const dir of [-1, 1] as const) {
                draws.push(ambientSprite({ id: `coin-${index}-spray-${dir < 0 ? 'l' : 'r'}`, cell: 'drop', x: x + (dir * radius * 1.2 * q) / SCENE_PLATE_ASPECT, y: yFloor - 0.035 * scale * 4 * q * (1 - q), size: 0.02 * scale, alpha: 0.7 * (1 - q) }));
            }
        }
        const sunk = Math.min(1, under / 1.4);
        draws.push(coinDraw(1 - 0.72 * sunk, 0.01 * sunk * scale));
        return draws;
    }
    if (!lean) {
        // Its shadow on the floor: wide and faint while it is high, tight and dark as it comes down onto it.
        const lift = pose.height * scale;
        const close = 1 / (1 + 14 * lift);
        draws.push({
            kind: 'glow',
            id: `coinshadow-${index}`,
            alpha: 0.7 * close,
            blend: 'source-over',
            cx: x,
            cy: yFloor + radius * view.foreshortening * 0.15,
            rx: (radius * (1.05 + 2.5 * lift)) / SCENE_PLATE_ASPECT,
            ry: radius * view.foreshortening * (1.1 + 2.5 * lift),
            stops: [
                [0, 'rgba(10, 6, 2, 0.75)'],
                [0.6, 'rgba(10, 6, 2, 0.35)'],
                [1, 'rgba(10, 6, 2, 0)']
            ]
        });
    }
    draws.push(coinDraw(1));
    // Lying there, it catches the light now and then.
    if (pose.still && place.t !== undefined) {
        const glint = sceneOccurrence(place.t + index * 977, 6000 + 3000 * sceneHash(index, 5), 700, 211 + index);
        if (glint) {
            const swell = Math.sin(glint.progress * Math.PI);
            draws.push(ambientSprite({ id: `coin-${index}-glint`, cell: 'glint', x: x - (radius * 0.4) / SCENE_PLATE_ASPECT, y: y - radius * view.foreshortening * 0.3, size: radius * 2.4 * (0.6 + 0.4 * swell), alpha: 0.85 * swell, blend: 'lighter' }));
        }
    }
    return draws;
};

export const composeGameplayScene = (input: GameplayFrameInput, clock: SceneClock): SceneDraw[] => {
    const { mood } = input;
    const still = input.tier === 'still';
    const lean = input.tier === 'lean';
    const { t } = clock;
    const ring = sceneRingLevels(input.fill, input.comboHeat, input.comboHueDeg);
    const relics = mood?.relics ?? [];
    const plateId = mood?.plate ?? 'dungeon';
    const tempo = mood?.tempo && mood.tempo > 0 ? mood.tempo : 1;
    const draws: SceneDraw[] = [];

    // Another room is a switch, not a blend: the dungeon's stone, light, mist and flames leave together.
    const dungeon = clock.smooth('plate:dungeon', plateId === 'dungeon' ? 1 : 0, 900);
    const shop = clock.smooth('plate:shop', plateId === 'shop' ? 1 : 0, 900);
    const voidRoom = clock.smooth('plate:void', plateId === 'void' ? 1 : 0, 900);
    const realmRoom = clock.smooth('plate:realm', plateId === 'realm' ? 1 : 0, 900);
    const realmArt = mood?.realmRoom ? REALM_ROOM_ART[mood.realmRoom] : null;

    // The beats: each keyed to the turn that made it, so one turn is one beat and a restore replays none.
    // Asked every frame, break or no break: the clock has to have seen "no break" for the first one to be a change.
    const sincePulse = clock.since('pulse', input.pulse === 'none' ? null : (input.pulseKey ?? input.pulse));
    const sinceMiss = clock.since('miss', mood?.missKey ?? null);
    const sinceFreeze = clock.since('freeze', mood?.freezeKey ?? null);
    const sinceCleared = clock.since('cleared', input.cleared);
    const sinceFever = clock.since('fever', input.feverKey);
    const sinceReturn = clock.since('void-return', mood?.voidReturnKey ?? null);
    const frozen = sinceFreeze < 900;
    // The things in the room run on their own time: faster with the surge, stopped for a freeze.
    const roomT = still ? 0 : clock.phase('room', frozen ? 0 : tempo);

    // A miss: the room darkens for a breath.
    const missDim = sinceMiss < 700 ? sceneKeyframes(sinceMiss / 700, [[0, 1], [0.2, 0.45], [1, 1]]) : 1;
    draws.push({ kind: 'image', id: 'base', src: UI_ART.gameplaySceneBase, alpha: input.base * dungeon * missDim });
    draws.push({ kind: 'image', id: 'shop', src: UI_ART.gameplaySceneShop, alpha: input.base * shop * missDim });
    draws.push({ kind: 'image', id: 'void', src: UI_ART.gameplaySceneVoid, alpha: input.base * voidRoom * missDim });
    // The realm's own room (`realmRoomArt.ts`), in its layers: the dark base; the painting's moving
    // parts over it (water rippling, clouds billowing, vines swaying); each of its lights on its own
    // clock (`realmLayerLevel`), and the moving ones with them (lava flowing, flames licking, light
    // running up the ice). All of it climbs with the combo on the depth, and past full every light
    // drives an overdrive of itself, brighter with every link and without end.
    const depth = Math.max(0, input.comboDepth ?? 0);
    if (realmArt && mood?.realmRoom) {
        const realm = mood.realmRoom;
        draws.push({ kind: 'image', id: 'realm', src: realmArt.base, alpha: input.base * realmRoom * missDim });
        // The painting's own moving parts, warped live from the base: water, cloud, vines (`realmRoomWarpDraws`).
        if (!still) draws.push(...realmRoomWarpDraws(realm, realmArt.base, roomT, depth, input.base * realmRoom * missDim, lean));
        const parts = realmRoomSpriteDraws(realm, realmArt.sprites, roomT, depth, realmRoom, still);
        draws.push(...parts.filter((part) => part.blend !== 'lighter'));
        const over = comboSoftCap(Math.max(0, depth - 2), 0.6);
        for (const [family, src] of Object.entries(realmArt.glows)) {
            const level = still ? 0.35 + 0.65 * comboSoftCap(depth, 1) : realmLayerLevel(realm, family, roomT, depth);
            draws.push({ kind: 'image', id: `realmGlow-${family}`, src, alpha: realmRoom * Math.min(1, level), blend: 'lighter' });
            if (over > 0.004) {
                draws.push({ kind: 'image', id: `realmGlowOver-${family}`, src, alpha: realmRoom * over * Math.min(1, level), blend: 'lighter', filter: { brightness: 1 + 0.25 * depth, blurPx: 4 } });
            }
        }
        draws.push(...parts.filter((part) => part.blend === 'lighter'));
    }

    if (mood?.elements) {
        draws.push(...elementDraws(mood.elements, plateId, clock, input.compactArt ?? false));
    }

    // ---------------------------------------------------------------- the torches' painted light
    const perilLevel = clock.smooth('peril', mood?.peril ? 1 : 0, 900);
    const torchRest = 0.82 - 0.27 * perilLevel;
    draws.push({ kind: 'image', id: 'torchLightL', src: UI_ART.gameplaySceneLightTorchesL, alpha: torchRest * dungeon, blend: 'lighter' });
    draws.push({ kind: 'image', id: 'torchLightR', src: UI_ART.gameplaySceneLightTorchesR, alpha: torchRest * dungeon, blend: 'lighter' });

    // ---------------------------------------------------------------- the ring
    const breathing = input.memorize && !still ? 1 + 0.22 * sceneBreath(t, 3600) : 1;
    // A cleared floor: the room exhales. The ring swells bright and settles a little above where it was.
    const exhale = sinceCleared < 2600 ? sceneKeyframes(sinceCleared / 2600, [[0, 1], [0.18, 1.6], [1, 1.1]]) : input.cleared && !still ? 1.1 : 1;
    const ringLight = clock.smooth('ringLight', ring.light * (relics.includes('long_look') ? 1.35 : 1), 900);
    const ringGlow = clock.smooth('ringGlow', ring.glow, 900);
    draws.push({ kind: 'image', id: 'ringLight', src: UI_ART.gameplaySceneLightRing, alpha: ringLight * breathing * exhale * dungeon, blend: 'lighter' });
    // A break: the floor light flashes and settles; the peak grows with the chain.
    const pulseMs = input.pulse === 'fever' ? 1100 : 720;
    const pulseLevel = input.pulse === 'none' ? 0 : still ? ring.pulsePeak : ring.pulsePeak * sceneBeatEnvelope(sincePulse, pulseMs, 0.12);
    draws.push({ kind: 'image', id: 'ringPulse', src: UI_ART.gameplaySceneLightRing, alpha: pulseLevel * dungeon, blend: 'lighter' });

    const gutterLevel = Math.min(gutter(sinceCleared, 2600), gutter(sinceMiss, 700));
    const tallow = relics.includes('tallow_candle');
    const torchGlowFilter: SceneFilter | undefined = tallow ? { brightness: 1.25, saturate: 1.2 } : undefined;
    draws.push({
        kind: 'image',
        id: 'torchGlow',
        src: UI_ART.gameplaySceneGlowTorches,
        alpha: (tallow ? 1 : torchRest) * gutterLevel * dungeon,
        blend: 'lighter',
        filter: torchGlowFilter
    });
    // A break: the torches flare and settle, the peak set by the tier. Never under reduce motion.
    const flareMs = input.pulse === 'fever' ? 1000 : 640;
    const flare = input.pulse === 'none' || still ? 0 : sceneTorchFlarePeak(input.pulse) * sceneBeatEnvelope(sincePulse, flareMs, 0.14);
    draws.push({ kind: 'image', id: 'torchFlare', src: UI_ART.gameplaySceneGlowTorches, alpha: flare * dungeon, blend: 'lighter' });

    draws.push({
        kind: 'image',
        id: 'runeGlow',
        src: UI_ART.gameplaySceneGlowRunes,
        alpha: 0.85 * (still ? 1 : 0.9 + 0.2 * sceneBreath(roomT, 5200, 0.33)) * dungeon,
        blend: 'lighter',
        filter: relics.includes('gilded_chain') ? { hueDeg: 165, saturate: 1.4, brightness: 1.15 } : undefined
    });
    const deepPockets = relics.includes('deep_pockets');
    const ringHue = clock.smooth('ringHue', ring.hueDeg - (deepPockets ? 20 : 0), 900);
    const ringSaturate = clock.smooth('ringSaturate', ring.saturate * (deepPockets ? 1.15 : 1), 900);
    const ringFilter: SceneFilter = { hueDeg: ringHue, saturate: ringSaturate };
    draws.push({ kind: 'image', id: 'ringGlow', src: UI_ART.gameplaySceneGlowRing, alpha: ringGlow * breathing * exhale * dungeon, blend: 'lighter', filter: ringFilter });

    // ---------------------------------------------------------------- the weather on the room
    const snow = clock.smooth('snow', mood?.snow ?? 0, 1400);
    draws.push({ kind: 'image', id: 'snowGlow', src: UI_ART.gameplaySceneSnow, alpha: clock.smooth('snowGlow', mood?.snowGlow ?? 0, 1400) * 0.9 * dungeon, blend: 'lighter', filter: { blurPx: 7, brightness: 1.4 } });
    draws.push({ kind: 'image', id: 'snow', src: UI_ART.gameplaySceneSnow, alpha: snow * dungeon });
    draws.push({ kind: 'image', id: 'snow-shop', src: UI_ART.gameplaySceneSnowShop, alpha: snow * shop });
    draws.push({ kind: 'image', id: 'snow-void', src: UI_ART.gameplaySceneSnowVoid, alpha: snow * voidRoom });
    // Wet stone: a thin blue sheen on the upward faces, shimmering slowly.
    const wet = clock.smooth('wet', mood?.wet ?? 0, 1400);
    draws.push({ kind: 'image', id: 'wet', src: UI_ART.gameplaySceneWet, alpha: wet * (still ? 1 : 0.85 + 0.15 * sceneBreath(roomT, 10_000)) * dungeon, blend: 'screen' });
    // Frost: crystals growing in from the edges with the heat, a rime at the very edge at rest.
    const frost = clock.smooth('frost', mood?.frost ?? 0, 1200);
    const frostScale = 1.55 - 0.4 * frost;
    draws.push({
        kind: 'image',
        id: 'frost',
        src: UI_ART.gameplaySceneFrost,
        alpha: frost * 0.35 * (dungeon + realmRoom),
        blend: 'screen',
        rect: { x: (1 - frostScale) / 2, y: (1 - frostScale) / 2, w: frostScale, h: frostScale }
    });
    // A storm: the room flashes on an irregular beat, more often the hotter the combo. Never under reduce motion.
    const storm = mood?.storm ?? 0;
    if (storm > 0 && !still) {
        const period = (7 - 5 * storm) * 1000;
        const p = ((t % period) + period) % period / period;
        const flash = sceneKeyframes(p, [[0.88, 0], [0.89, 1], [0.91, 0.2], [0.93, 0.8], [0.96, 0], [1, 0]]);
        draws.push({
            kind: 'glow',
            id: 'stormFlash',
            alpha: p < 0.88 ? 0 : flash,
            blend: 'screen',
            cx: 0.5,
            cy: 0.2,
            rx: 0.7,
            ry: 0.6,
            stops: [
                [0, 'rgba(220, 200, 255, 0.55)'],
                [0.7, 'rgba(220, 200, 255, 0)'],
                [1, 'rgba(220, 200, 255, 0)']
            ]
        });
    }

    // And lightning comes down through the arches on the same beat, each bolt on its own phase of it.
    if (storm > 0 && !still) {
        const period = (7 - 5 * storm) * 1000;
        stormBoltsFor(input.runSeed, stormBoltCount(mood?.surge ?? 0)).forEach((points, index) => {
            const p = (((t / period - index * 0.37) % 1) + 1) % 1;
            const strike = p < 0.86 ? 0 : sceneKeyframes(p, [[0.86, 0], [0.87, 1], [0.89, 0.15], [0.91, 0.9], [0.95, 0], [1, 0]]);
            if (strike <= 0) {
                return;
            }
            // The glow, as three strokes each wider and fainter than the last, then the white core.
            draws.push({ kind: 'line', id: `bolt-${index}-halo`, alpha: strike * 0.16, blend: 'screen', points, color: '#b48cff', width: 0.03 });
            draws.push({ kind: 'line', id: `bolt-${index}-glow`, alpha: strike * 0.35, blend: 'screen', points, color: '#b48cff', width: 0.016 });
            draws.push({ kind: 'line', id: `bolt-${index}-edge`, alpha: strike * 0.6, blend: 'screen', points, color: '#c9adff', width: 0.007 });
            draws.push({ kind: 'line', id: `bolt-${index}`, alpha: strike, blend: 'screen', points, color: '#f4efff', width: 0.0029 });
        });
    }

    // Reaching Fever, or coming back from the void: one flash of the whole ring, thrown once.
    const arrival = Math.max(sceneBeatEnvelope(sinceFever, 1400, 0.09), sceneBeatEnvelope(sinceReturn, 1400, 0.09));
    draws.push({ kind: 'image', id: 'feverArrival', src: UI_ART.gameplaySceneGlowRing, alpha: Math.min(1, arrival * 1.35) * dungeon, blend: 'lighter' });

    // ---------------------------------------------------------------- the things in the room
    if (!still) {
        // Mist in the corridor beyond the ring.
        draws.push(fogDraw({ id: 'mist', t: roomT, alpha: 0.5 * dungeon, mask: { kind: 'ellipse', cx: 0.5, cy: 0.52, rx: 0.34, ry: 0.3, solid: 0.3 }, speed: 0.007, tileW: 0.7, seed: 1 }));
        // And lying low over the floor at the room's edges, where the torches do not reach.
        draws.push(fogDraw({ id: 'floor-mist', t: roomT, alpha: 0.22 * dungeon, mask: { kind: 'band', top: 0.74, solidFrom: 0.9, solidTo: 0.97, bottom: 1 }, speed: 0.004, tileW: 1, seed: 5 }));
    }

    const flameLevels = sceneFlameLevels(input.fill, input.imminent, input.comboHeat);
    const lift = clock.smooth('flameLift', flameLevels.lift, 420);
    const burned = still ? 0 : clock.phase('flames', frozen ? 0 : flameLevels.rate * tempo);
    if (!still) {
        // The light the two big torches throw, wavering with their flames, and the smoke off them.
        ([0, flames.sprites.length - 1] as const).forEach((torch, index) => {
            const sprite = flames.sprites[torch];
            if (!sprite) {
                return;
            }
            const x = sprite.x + sprite.w / 2;
            draws.push(ambientSprite({ id: `torch-pool-${index}`, cell: 'haloWarm', x, y: sprite.y + sprite.h * 0.7, size: 0.42, alpha: (0.26 + 0.1 * sceneFlicker(roomT, 3 + index)) * torchRest * gutterLevel * dungeon, depth: 0.5 }));
            for (let puff = 0; puff < 2; puff += 1) {
                const period = 5200;
                const p = (((roomT + (puff * period) / 2 + index * 900) % period) + period) % period / period;
                draws.push(
                    ambientSprite({
                        id: `torch-smoke-${index}-${puff}`,
                        cell: 'smoke',
                        x: x + 0.012 * Math.sin(p * 4 + index),
                        y: sprite.y - 0.11 * p,
                        size: 0.05 + 0.07 * p,
                        alpha: 0.2 * Math.sin(p * Math.PI) * dungeon,
                        blend: 'source-over'
                    })
                );
            }
        });
    }
    draws.push(...flameDraws(flames.sprites, { burnedMs: burned, lift, alpha: dungeon, still }));
    if (!still) {
        const emberLevel = clock.smooth('flameEmbers', flameLevels.embers, 420);
        draws.push(...flameEmberDraws(flames.sprites, clock.phase('embers', frozen ? 0 : flameLevels.emberRate * tempo), emberLevel * dungeon));
        // The ring's own light lifting off the floor, from nothing at rest to a full drift at Fever.
        const ringMoteLevel = clock.smooth('ringMotes', Math.min(1, ring.motes), 900);
        const motes = RING_MOTES;
        draws.push(...moteDraws(lean ? motes.filter((_, index) => index % 2 === 0) : motes, 'dotViolet', roomT, ringMoteLevel * dungeon, 'ring-mote'));
        draws.push(...glintDraws({ idPrefix: 'ring-glint', points: RING_GLINTS, t: roomT, everyMs: 8000 - 5000 * Math.min(1, ring.motes), lastsMs: 1300, size: 0.05, alpha: (0.35 + 0.65 * ringMoteLevel) * dungeon, seed: 13 }));

        // Dust turning in the torchlight on each wall.
        draws.push(...driftDraws({ idPrefix: 'dust-left', cell: 'dust', count: lean ? 5 : 10, x: 0.03, y: 0.1, w: 0.3, h: 0.55, fall: 0.014, slide: 0.005, size: 0.014, alpha: 0.5 * dungeon, seed: 17 }, roomT));
        draws.push(...driftDraws({ idPrefix: 'dust-right', cell: 'dust', count: lean ? 5 : 10, x: 0.67, y: 0.1, w: 0.3, h: 0.55, fall: 0.013, slide: -0.005, size: 0.014, alpha: 0.5 * dungeon, seed: 19 }, roomT));
        draws.push(...dripDraws({ idPrefix: 'drip', t: roomT, everyMs: 13_000, seed: 23, spots: DRIP_SPOTS, alpha: 0.75 * dungeon }));
        draws.push(...crossingDraws({ id: 'bat', cell: 'bat', t: roomT, everyMs: GAMEPLAY_BAT_EVERY_MS, lastsMs: 3600, seed: 29, fromX: 0.38, toX: 0.62, yMin: 0.3, yMax: 0.42, size: 0.03, alpha: 0.85 * dungeon, bob: 0.008 }));

        // Eyes in the dark of a far passage: they open, blink once, and are gone.
        const eyes = sceneOccurrence(roomT, GAMEPLAY_EYES_EVERY_MS, GAMEPLAY_EYES_LAST_MS, 31);
        if (eyes) {
            const [ex, ey] = EYE_SPOTS[Math.floor(sceneHash(eyes.index, 32) * EYE_SPOTS.length)] ?? EYE_SPOTS[0]!;
            const open = Math.min(sceneSmoothstep(0, 0.12, eyes.progress), sceneSmoothstep(1, 0.9, eyes.progress));
            const blink = eyes.progress > 0.46 && eyes.progress < 0.5 ? 0 : 1;
            for (const side of [-1, 1] as const) {
                draws.push(ambientSprite({ id: `eyes-${side < 0 ? 'l' : 'r'}`, cell: 'dotEmber', x: ex + side * 0.0045, y: ey, size: 0.011, alpha: 0.8 * open * blink * dungeon }));
            }
        }

        // A spider lets itself down from the left arch, hangs, and climbs back.
        const spider = sceneOccurrence(roomT, GAMEPLAY_SPIDER_EVERY_MS, GAMEPLAY_SPIDER_LASTS_MS, 37);
        if (spider) {
            const drop = sceneKeyframes(spider.progress, [[0, 0], [0.3, 1], [0.62, 1], [1, 0]]);
            const x = 0.226 + 0.002 * Math.sin(spider.progress * 30);
            const y = -0.02 + 0.3 * drop * drop * (3 - 2 * drop);
            draws.push({ kind: 'line', id: 'spider-thread', alpha: 0.35 * dungeon, points: [[0.226, 0], [x, y]], color: 'rgb(190, 196, 210)', width: 0.0012, depth: 1 });
            draws.push(ambientSprite({ id: 'spider', cell: 'spider', x, y: y + 0.008, size: 0.026, alpha: 0.9 * dungeon, blend: 'source-over' }));
        }

        // An ember run's weather: sparks and ash drifting up off the floor, thicker with the heat.
        const ash = mood?.ash ?? 0;
        if (ash > 0) {
            const cells = DRIFT_CELLS[mood?.driftTone ?? 'ember'];
            const count = emberMoteCount(mood?.surge ?? 0) + Math.round(ash * 14);
            const drift = emberDriftFor(input.runSeed, lean ? Math.ceil(count / 2) : count);
            const level = 0.7 + 0.3 * ash;
            drift.forEach((mote, index) => {
                const durationMs = mote.duration * 1000;
                const p = (((roomT + mote.phase * durationMs) % durationMs) + durationMs) % durationMs / durationMs;
                draws.push(
                    ambientSprite({
                        id: `drift-${index}`,
                        cell: mote.spark ? cells.spark : cells.ash,
                        x: (mote.x + sceneKeyframes(p, [[0, 0], [0.5, mote.sway], [1, -0.4 * mote.sway]])) / EMBER_VIEWBOX.width,
                        y: (mote.y - mote.rise * p) / EMBER_VIEWBOX.height,
                        size: ((mote.r * (mote.spark ? 7 : 5)) / EMBER_VIEWBOX.height) * sceneKeyframes(p, [[0, 1], [0.5, 0.9], [1, 0.5]]),
                        alpha: level * sceneKeyframes(p, [[0, 0], [0.12, 0.95], [0.8, 0.6], [1, 0]]),
                        blend: mote.spark ? 'lighter' : 'screen'
                    })
                );
            });
        }
    }

    // A realm's own room is never still: its weather, its light and its creatures (`realmRoomLife.ts`).
    if (!still && mood?.realmRoom) {
        draws.push(...realmRoomLifeDraws({ realm: mood.realmRoom, t: roomT, depth, lean, alpha: realmRoom }));
    }

    // A payout: coins fall through the room, in front of the stone and behind the cards. Asked every
    // frame, paid or not: a clock that first hears of a shower when it is already falling takes it
    // for a restore and drops it, which is what the first payout of every room used to be.
    // Every shower this floor has paid lies where it fell (`goldRain.ts`): each in its own slot,
    // timed from when it arrived, and one found already there (a restore) lies at rest. On a realm's
    // own room it lands on that room's floor, and in the Drowned Vault it sinks.
    const pile = mood?.goldPile ?? (mood?.goldRain ? [{ ...mood.goldRain, slot: 0 }] : []);
    const realmFloor = plateId === 'realm' && mood?.realmRoom ? REALM_FLOORS[mood.realmRoom] : null;
    const coinPlace = { band: realmFloor?.band ?? GOLD_RAIN_FLOOR, water: realmFloor?.water ?? false, t: still ? undefined : roomT };
    let coinBudget = lean ? Math.ceil(GOLD_PILE_MAX_COINS / 2) : GOLD_PILE_MAX_COINS;
    const bySlot = new Map(pile.map((shower) => [shower.slot, shower]));
    const sinceBySlot = new Map<number, number>();
    for (let slot = 0; slot < GOLD_PILE_SLOTS; slot += 1) {
        sinceBySlot.set(slot, clock.since(`gold-pile:${slot}`, bySlot.get(slot)?.key ?? null) / 1000);
    }
    // Oldest first, as the pile keeps them.
    const showers = pile.map((shower) => ({ coins: goldRainFor(shower.key, lean ? Math.ceil(shower.coins / 2) : shower.coins), since: sinceBySlot.get(shower.slot) ?? Number.POSITIVE_INFINITY, slot: shower.slot }));
    // The newest gold first against the budget: the oldest coins are the ones that go.
    const shown: { coin: GoldCoin; seconds: number; id: number }[] = [];
    for (let s = showers.length - 1; s >= 0 && coinBudget > 0; s -= 1) {
        const { coins, since, slot } = showers[s]!;
        const kept = coins.slice(0, coinBudget);
        coinBudget -= kept.length;
        kept.forEach((coin, index) => shown.push({ coin, seconds: still ? Number.POSITIVE_INFINITY : since - coin.delay, id: slot * GOLD_RAIN_MAX_COINS + index }));
    }
    // Far coins first, so a near one lies over a far one.
    shown.sort((a, b) => b.coin.depth - a.coin.depth);
    for (const { coin, seconds, id } of shown) {
        draws.push(...goldCoinDraws(coin, id, seconds, lean, coinPlace));
    }
    // What the breaking cards spilled: their embers, drops, shards, leaves and chips, landing on this floor.
    if (!still) {
        for (const spill of input.spills ?? []) draws.push(...roomSpillDraws(spill, coinPlace.band, coinPlace.water, lean));
    }

    // Peril: the bank is empty. A red edge breathes until a miss is banked again.
    draws.push({
        kind: 'glow',
        id: 'peril',
        alpha: perilLevel * (still ? 1 : 0.55 + 0.45 * sceneBreath(t, 2800)),
        blend: 'source-over',
        cx: 0.5,
        cy: 0.5,
        rx: 0.78,
        ry: 0.78,
        stops: [
            [0, 'rgba(210, 40, 40, 0)'],
            [0.58, 'rgba(210, 40, 40, 0)'],
            [1, 'rgba(210, 40, 40, 0.6)']
        ]
    });
    return draws;
};
