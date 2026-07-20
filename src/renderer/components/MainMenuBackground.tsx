import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Application, Container, Sprite, Texture } from 'pixi.js';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { getMenuAtmosphereParticleCount, getMenuPixiResolutionCap } from '../../shared/graphicsQuality';
import type { TiltVector } from '../platformTilt/platformTiltTypes';
import type * as PixiNamespace from 'pixi.js';
import { RENDERER_THEME } from '../styles/theme';
import styles from './MainMenuBackground.module.css';

interface MainMenuBackgroundProps {
    fieldTiltRef: MutableRefObject<TiltVector>;
    graphicsQuality?: GraphicsQualityPreset;
    height: number;
    reduceMotion: boolean;
    /** When true, hide the patterned fallback so nothing reads as “loading” behind the startup intro. */
    suppressLoadingFallback?: boolean;
    width: number;
}

type PixiModule = typeof PixiNamespace;

interface GlowState {
    alpha: number;
    driftX: number;
    driftY: number;
    phase: number;
    pulse: number;
    speed: number;
    sprite: Sprite;
    x: number;
    y: number;
}

type ParticleKind = 'orb' | 'streak';

interface ParticleState {
    alpha: number;
    alphaShift: number;
    driftX: number;
    driftY: number;
    kind: ParticleKind;
    lightAlpha: number;
    lightShift: number;
    lightSprite: Sprite;
    phase: number;
    rotation: number;
    rotationSpeed: number;
    shimmer: number;
    speed: number;
    sprite: Sprite;
    vx: number;
    vy: number;
    wrapPadding: number;
    x: number;
    y: number;
}

interface SceneController {
    destroy: () => void;
    resize: (width: number, height: number) => void;
    setGraphicsQuality: (quality: GraphicsQualityPreset) => void;
    setReduceMotion: (reduceMotion: boolean) => void;
    /** PERF-003: pause Pixi ticker while tab is hidden; resume when visible if motion is on. */
    setPageVisibilityPaused: (paused: boolean) => void;
    /** For tests / debugging: last applied field tilt after transforms. */
    getLastFieldTilt: () => TiltVector;
}

const { colors } = RENDERER_THEME;
const BACKDROP_VIGNETTE = 'rgba(5, 6, 8, 0.5)';
const BACKDROP_CENTER = 'rgba(11, 16, 26, 0.04)';
const PARTICLE_COLORS = [colors.goldBright, colors.cyan, colors.rune, colors.ember] as const;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const wrapCoordinate = (value: number, size: number, padding: number): number => {
    if (value < -padding) {
        return size + padding;
    }

    if (value > size + padding) {
        return -padding;
    }

    return value;
};

const hashUnit = (index: number, salt: number): number => {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.replace('#', '');
    const expanded =
        normalized.length === 3
            ? normalized
                  .split('')
                  .map((segment) => `${segment}${segment}`)
                  .join('')
            : normalized;

    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const hexToColorNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);

const safelyDestroyApplication = (app: Application): void => {
    try {
        app.destroy({ removeView: true }, { children: true });
    } catch {
        // Pixi can partially initialize before rejecting; ignore teardown errors and fall back cleanly.
    }
};

const createCanvasTexture = (
    pixi: PixiModule,
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
): Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Main menu background could not allocate a 2D drawing context.');
    }

    draw(context, canvas);

    return pixi.Texture.from(canvas);
};

const createSoftOrbTexture = (pixi: PixiModule): Texture =>
    createCanvasTexture(pixi, 192, 192, (context, canvas) => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2;
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.22, 'rgba(255, 255, 255, 0.72)');
        gradient.addColorStop(0.56, 'rgba(255, 255, 255, 0.18)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
    });

const createStreakTexture = (pixi: PixiModule): Texture =>
    createCanvasTexture(pixi, 240, 64, (context, canvas) => {
        const gradient = context.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);

        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.82, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const verticalFeather = context.createLinearGradient(0, 0, 0, canvas.height);
        verticalFeather.addColorStop(0, 'rgba(255, 255, 255, 0)');
        verticalFeather.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        verticalFeather.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = verticalFeather;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.globalCompositeOperation = 'source-over';
    });

const createBackdropTexture = (pixi: PixiModule, width: number, height: number): Texture =>
    createCanvasTexture(pixi, width, height, (context, canvas) => {
        const vignette = context.createRadialGradient(
            canvas.width / 2,
            canvas.height * 0.48,
            Math.min(canvas.width, canvas.height) * 0.14,
            canvas.width / 2,
            canvas.height * 0.52,
            Math.max(canvas.width, canvas.height) * 0.82
        );

        vignette.addColorStop(0, BACKDROP_CENTER);
        vignette.addColorStop(0.58, 'rgba(6, 9, 15, 0.08)');
        vignette.addColorStop(1, BACKDROP_VIGNETTE);

        context.fillStyle = vignette;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const veil = context.createLinearGradient(0, 0, 0, canvas.height);
        veil.addColorStop(0, 'rgba(5, 6, 8, 0)');
        veil.addColorStop(0.72, 'rgba(5, 6, 8, 0.08)');
        veil.addColorStop(1, 'rgba(5, 6, 8, 0.22)');

        context.fillStyle = veil;
        context.fillRect(0, 0, canvas.width, canvas.height);
    });

const createGridTexture = (pixi: PixiModule, width: number, height: number): Texture =>
    createCanvasTexture(pixi, width, height, (context, canvas) => {
        const spacing = width <= 720 || height <= 720 ? 72 : 88;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.max(canvas.width, canvas.height) * 0.72;

        const lineAlpha = (x: number, y: number): number => {
            const distance = Math.hypot(x - centerX, y - centerY);
            const normalized = clamp(distance / maxRadius, 0, 1);
            return 0.02 + (1 - normalized) * 0.06;
        };

        context.lineWidth = 1;

        for (let x = 0; x <= canvas.width + spacing; x += spacing) {
            const alpha = lineAlpha(x, centerY);

            context.strokeStyle = x % (spacing * 4) === 0 ? hexToRgba(colors.goldBright, alpha * 0.7) : hexToRgba(colors.text, alpha * 0.55);
            context.beginPath();
            context.moveTo(x + 0.5, 0);
            context.lineTo(x + 0.5, canvas.height);
            context.stroke();
        }

        for (let y = 0; y <= canvas.height + spacing; y += spacing) {
            const alpha = lineAlpha(centerX, y);

            context.strokeStyle = y % (spacing * 4) === 0 ? hexToRgba(colors.cyanBright, alpha * 0.62) : hexToRgba(colors.text, alpha * 0.46);
            context.beginPath();
            context.moveTo(0, y + 0.5);
            context.lineTo(canvas.width, y + 0.5);
            context.stroke();
        }

        const centerWash = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(canvas.width, canvas.height) * 0.76);
        centerWash.addColorStop(0, 'rgba(255, 255, 255, 0)');
        centerWash.addColorStop(0.78, 'rgba(255, 255, 255, 0.01)');
        centerWash.addColorStop(1, 'rgba(255, 255, 255, 0.08)');

        context.fillStyle = centerWash;
        context.fillRect(0, 0, canvas.width, canvas.height);
    });

const pickParticleColor = (index: number): string => PARTICLE_COLORS[index % PARTICLE_COLORS.length];

const createSceneController = (
    pixi: PixiModule,
    app: Application,
    initialWidth: number,
    initialHeight: number,
    initialReduceMotion: boolean,
    initialGraphicsQuality: GraphicsQualityPreset,
    fieldTiltRef: MutableRefObject<TiltVector>
): SceneController => {
    const root = new pixi.Container();
    const fogLayer = new pixi.Container();
    const gridLayer = new pixi.Container();
    const gridLightLayer = new pixi.Container();
    const particleLayer = new pixi.Container();

    root.addChild(fogLayer);
    root.addChild(gridLayer);
    root.addChild(gridLightLayer);
    root.addChild(particleLayer);
    app.stage.addChild(root);

    const sharedTextures = {
        orb: createSoftOrbTexture(pixi),
        streak: createStreakTexture(pixi)
    };

    const dynamicTextures = new Set<Texture>();
    const glows: GlowState[] = [];
    const particles: ParticleState[] = [];

    let reduceMotion = initialReduceMotion;
    let graphicsQuality = initialGraphicsQuality;
    let surfaceWidth = Math.max(1, initialWidth);
    let surfaceHeight = Math.max(1, initialHeight);
    let lastFieldTilt: TiltVector = { x: 0, y: 0 };
    let gridSpacing = surfaceWidth <= 720 || surfaceHeight <= 720 ? 72 : 88;
    let animationActive = false;
    let pageVisibilityPaused = false;
    let lastFrameTime = performance.now();

    const registerDynamicTexture = (texture: Texture): Texture => {
        dynamicTextures.add(texture);
        return texture;
    };

    const destroyDynamicTextures = (): void => {
        for (const texture of dynamicTextures) {
            texture.destroy();
        }

        dynamicTextures.clear();
    };

    const destroyChildren = (container: Container): void => {
        const children = container.removeChildren();

        for (const child of children) {
            child.destroy({ children: true });
        }
    };

    const stopAnimation = (): void => {
        if (!animationActive) {
            return;
        }

        app.ticker.remove(updateScene);
        app.stop();
        animationActive = false;
    };

    const renderStaticFrame = (): void => {
        applyTransforms(performance.now());
        app.render();
    };

    const applyRendererResolution = (): void => {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const cap = getMenuPixiResolutionCap(graphicsQuality);
        app.renderer.resolution = Math.min(dpr, cap);
    };

    const rebuildScene = (): void => {
        destroyChildren(fogLayer);
        destroyChildren(gridLayer);
        destroyChildren(gridLightLayer);
        destroyChildren(particleLayer);
        destroyDynamicTextures();

        glows.length = 0;
        particles.length = 0;
        gridSpacing = surfaceWidth <= 720 || surfaceHeight <= 720 ? 72 : 88;

        const backdrop = new pixi.Sprite(registerDynamicTexture(createBackdropTexture(pixi, surfaceWidth, surfaceHeight)));
        backdrop.width = surfaceWidth;
        backdrop.height = surfaceHeight;
        backdrop.alpha = 0.92;
        fogLayer.addChild(backdrop);

        const maxDimension = Math.max(surfaceWidth, surfaceHeight);
        const glowDefinitions = [
            { alpha: 0.17, color: colors.goldBright, driftX: 18, driftY: 11, phase: 0.3, pulse: 0.024, scaleX: 1.2, scaleY: 0.94, speed: 0.00019, x: 0.16, y: 0.16 },
            { alpha: 0.15, color: colors.cyanBright, driftX: -16, driftY: 16, phase: 1.2, pulse: 0.026, scaleX: 1.32, scaleY: 1.04, speed: 0.00016, x: 0.84, y: 0.14 },
            { alpha: 0.1, color: colors.emberSoft, driftX: 16, driftY: -20, phase: 2.4, pulse: 0.018, scaleX: 0.96, scaleY: 1.18, speed: 0.00013, x: 0.54, y: 0.76 },
            { alpha: 0.06, color: colors.rune, driftX: 10, driftY: 8, phase: 3.1, pulse: 0.012, scaleX: 0.6, scaleY: 0.5, speed: 0.00012, x: 0.48, y: 0.42 }
        ] as const;

        for (const definition of glowDefinitions) {
            const sprite = new pixi.Sprite(sharedTextures.orb);
            sprite.anchor.set(0.5);
            sprite.tint = hexToColorNumber(definition.color);
            sprite.width = maxDimension * definition.scaleX;
            sprite.height = maxDimension * definition.scaleY;
            fogLayer.addChild(sprite);
            glows.push({
                alpha: definition.alpha,
                driftX: definition.driftX,
                driftY: definition.driftY,
                phase: definition.phase,
                pulse: definition.pulse,
                speed: definition.speed,
                sprite,
                x: surfaceWidth * definition.x,
                y: surfaceHeight * definition.y
            });
        }

        const grid = new pixi.Sprite(registerDynamicTexture(createGridTexture(pixi, surfaceWidth, surfaceHeight)));
        grid.width = surfaceWidth;
        grid.height = surfaceHeight;
        grid.alpha = 0.52;
        gridLayer.addChild(grid);

        const particleCount = getMenuAtmosphereParticleCount(surfaceWidth, surfaceHeight, graphicsQuality);
        const streakCount = Math.max(3, Math.round(particleCount * 0.28));

        for (let index = 0; index < particleCount; index += 1) {
            const kind: ParticleKind = index < streakCount && index % 2 === 0 ? 'streak' : 'orb';
            const sprite = new pixi.Sprite(kind === 'streak' ? sharedTextures.streak : sharedTextures.orb);
            const lightSprite = new pixi.Sprite(sharedTextures.orb);
            const color = pickParticleColor(index);
            const scale = kind === 'streak' ? 0.34 + hashUnit(index, 4) * 0.56 : 0.16 + hashUnit(index, 4) * 0.4;

            sprite.anchor.set(0.5);
            sprite.tint = hexToColorNumber(color);
            sprite.width = sharedTextures[kind].width * scale * (kind === 'streak' ? 1.9 : 1);
            sprite.height = sharedTextures[kind].height * scale * (kind === 'streak' ? 0.9 : 1);
            lightSprite.anchor.set(0.5);
            lightSprite.tint = hexToColorNumber(color);
            lightSprite.width = gridSpacing * (kind === 'streak' ? 1.45 : 1.18);
            lightSprite.height = gridSpacing * (kind === 'streak' ? 1.45 : 1.18);
            const startX = hashUnit(index, 16) * surfaceWidth;
            const startY = hashUnit(index, 17) * surfaceHeight;
            const wrapPadding = Math.max(sprite.width, lightSprite.width) * (kind === 'streak' ? 0.95 : 0.8) + 40;

            gridLightLayer.addChild(lightSprite);
            particleLayer.addChild(sprite);

            particles.push({
                alpha: kind === 'streak' ? 0.1 + hashUnit(index, 5) * 0.04 : 0.08 + hashUnit(index, 5) * 0.06,
                alphaShift: 0.018 + hashUnit(index, 6) * 0.024,
                driftX: kind === 'streak' ? 10 + hashUnit(index, 7) * 14 : 7 + hashUnit(index, 7) * 11,
                driftY: kind === 'streak' ? 7 + hashUnit(index, 8) * 10 : 6 + hashUnit(index, 8) * 8,
                kind,
                lightAlpha: kind === 'streak' ? 0.08 + hashUnit(index, 18) * 0.04 : 0.05 + hashUnit(index, 18) * 0.03,
                lightShift: 0.022 + hashUnit(index, 19) * 0.03,
                lightSprite,
                phase: hashUnit(index, 9) * Math.PI * 2,
                rotation: hashUnit(index, 10) * Math.PI * 2,
                rotationSpeed: (hashUnit(index, 11) - 0.5) * (kind === 'streak' ? 0.14 : 0.08),
                shimmer: 0.0005 + hashUnit(index, 12) * 0.00034,
                speed: 0.00032 + hashUnit(index, 13) * 0.0003,
                sprite,
                vx: (hashUnit(index, 14) - 0.5) * (kind === 'streak' ? 28 : 18),
                vy: (hashUnit(index, 15) - 0.5) * (kind === 'streak' ? 14 : 9),
                wrapPadding,
                x: startX,
                y: startY
            });
        }

        renderStaticFrame();
    };

    const applyTransforms = (time: number): void => {
        const tx = reduceMotion ? 0 : fieldTiltRef.current.x;
        const ty = reduceMotion ? 0 : fieldTiltRef.current.y;

        lastFieldTilt = { x: tx, y: ty };

        const gridShiftX = tx * surfaceWidth * 0.024;
        const gridShiftY = ty * surfaceHeight * 0.022;
        const fogShiftX = tx * surfaceWidth * 0.008;
        const fogShiftY = ty * surfaceHeight * 0.007;
        const particleCounterX = tx * 11;
        const particleCounterY = ty * 9;

        gridLayer.position.set(gridShiftX, gridShiftY);
        gridLayer.rotation = tx * 0.02 - ty * 0.016;
        fogLayer.position.set(fogShiftX, fogShiftY);

        for (const glow of glows) {
            const movement = reduceMotion ? 0 : Math.sin(time * glow.speed + glow.phase);
            const altitude = reduceMotion ? 0 : Math.cos(time * glow.speed * 0.84 + glow.phase) * 0.9;

            glow.sprite.x = glow.x + movement * glow.driftX;
            glow.sprite.y = glow.y + altitude * glow.driftY;
            glow.sprite.alpha = glow.alpha + (reduceMotion ? 0 : Math.sin(time * glow.speed * 1.2 + glow.phase) * glow.pulse);
        }

        for (const particle of particles) {
            const movement = reduceMotion ? 0 : Math.sin(time * particle.speed + particle.phase);
            const altitude = reduceMotion ? 0 : Math.cos(time * particle.speed * 0.92 + particle.phase) * 0.85;
            const particleX = particle.x + movement * particle.driftX;
            const particleY = particle.y + altitude * particle.driftY;
            const lightPulse = reduceMotion ? 0 : Math.sin(time * particle.shimmer * 0.74 + particle.phase);
            const insideView =
                particleX >= -particle.wrapPadding &&
                particleX <= surfaceWidth + particle.wrapPadding &&
                particleY >= -particle.wrapPadding &&
                particleY <= surfaceHeight + particle.wrapPadding;
            const lightLagX = reduceMotion ? 0 : Math.cos(time * particle.speed * 0.58 + particle.phase * 1.1) * (particle.kind === 'streak' ? 12 : 8);
            const lightLagY = reduceMotion ? 0 : Math.sin(time * particle.speed * 0.54 + particle.phase * 0.8) * (particle.kind === 'streak' ? 9 : 6);
            const lightScale = particle.kind === 'streak' ? 1.05 : 0.92;

            particle.sprite.x = particleX - particleCounterX;
            particle.sprite.y = particleY - particleCounterY;
            particle.sprite.rotation = particle.rotation + (reduceMotion ? 0 : Math.sin(time * particle.speed * 0.48 + particle.phase) * particle.rotationSpeed);
            particle.sprite.alpha = particle.alpha + (reduceMotion ? 0 : Math.sin(time * particle.shimmer + particle.phase) * particle.alphaShift);
            particle.lightSprite.x = particleX + lightLagX - particleCounterX * 0.62;
            particle.lightSprite.y = particleY + lightLagY - particleCounterY * 0.62;
            particle.lightSprite.scale.set(lightScale + lightPulse * 0.08);
            particle.lightSprite.alpha = insideView ? particle.lightAlpha + lightPulse * particle.lightShift : 0;
        }
    };

    const updateScene = (): void => {
        const now = performance.now();
        const deltaSeconds = Math.min(0.032, (now - lastFrameTime) / 1000);

        lastFrameTime = now;

        for (const particle of particles) {
            particle.x = wrapCoordinate(particle.x + particle.vx * deltaSeconds, surfaceWidth, particle.wrapPadding);
            particle.y = wrapCoordinate(particle.y + particle.vy * deltaSeconds, surfaceHeight, particle.wrapPadding);
        }

        applyTransforms(now);
    };

    const startAnimation = (): void => {
        if (reduceMotion || animationActive || pageVisibilityPaused) {
            return;
        }

        lastFrameTime = performance.now();
        app.ticker.add(updateScene);
        app.start();
        animationActive = true;
    };

    applyRendererResolution();

    return {
        destroy: () => {
            stopAnimation();
            destroyChildren(fogLayer);
            destroyChildren(gridLayer);
            destroyChildren(gridLightLayer);
            destroyChildren(particleLayer);
            destroyDynamicTextures();
            sharedTextures.orb.destroy();
            sharedTextures.streak.destroy();
            app.destroy({ removeView: true }, { children: true });
        },
        resize: (width, height) => {
            surfaceWidth = Math.max(1, Math.round(width));
            surfaceHeight = Math.max(1, Math.round(height));
            applyRendererResolution();
            rebuildScene();

            if (!reduceMotion) {
                startAnimation();
            }
        },
        setGraphicsQuality: (nextQuality) => {
            if (graphicsQuality === nextQuality) {
                return;
            }
            graphicsQuality = nextQuality;
            applyRendererResolution();
            rebuildScene();
        },
        setReduceMotion: (nextReduceMotion) => {
            reduceMotion = nextReduceMotion;

            if (reduceMotion) {
                stopAnimation();
                renderStaticFrame();
                return;
            }

            renderStaticFrame();
            startAnimation();
        },
        setPageVisibilityPaused: (paused) => {
            pageVisibilityPaused = paused;
            if (paused) {
                stopAnimation();
                return;
            }
            renderStaticFrame();
            startAnimation();
        },
        getLastFieldTilt: () => lastFieldTilt
    };
};

const MainMenuBackground = ({
    fieldTiltRef: menuFieldTiltRef,
    graphicsQuality = 'medium',
    height,
    reduceMotion,
    suppressLoadingFallback = false,
    width
}: MainMenuBackgroundProps) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<SceneController | null>(null);
    const latestPropsRef = useRef({ graphicsQuality, height, reduceMotion, width });
    const [renderStatus, setRenderStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

    useEffect(() => {
        latestPropsRef.current = { graphicsQuality, height, reduceMotion, width };
    }, [graphicsQuality, height, reduceMotion, width]);

    useEffect(() => {
        sceneRef.current?.setGraphicsQuality(graphicsQuality);
    }, [graphicsQuality]);

    useEffect(() => {
        let disposed = false;
        let app: Application | null = null;

        const initialize = async (): Promise<void> => {
            const host = hostRef.current;

            if (!host) {
                return;
            }

            try {
                const pixi = await import('pixi.js');

                if (disposed) {
                    return;
                }

                const initialGraphicsQuality = latestPropsRef.current.graphicsQuality;

                app = new pixi.Application();

                await app.init({
                    antialias: initialGraphicsQuality !== 'low',
                    autoDensity: true,
                    autoStart: false,
                    backgroundAlpha: 0,
                    powerPreference: 'high-performance',
                    preference: 'webgl',
                    resizeTo: host
                });

                if (disposed) {
                    safelyDestroyApplication(app);
                    return;
                }

                const {
                    graphicsQuality: currentGq,
                    height: currentHeight,
                    reduceMotion: currentReduceMotion,
                    width: currentWidth
                } = latestPropsRef.current;

                app.canvas.className = styles.atmosphereCanvas;
                app.canvas.setAttribute('aria-hidden', 'true');
                host.appendChild(app.canvas);

                sceneRef.current = createSceneController(
                    pixi,
                    app,
                    currentWidth,
                    currentHeight,
                    currentReduceMotion,
                    currentGq,
                    menuFieldTiltRef
                );
                sceneRef.current.setPageVisibilityPaused(
                    typeof document !== 'undefined' && document.visibilityState !== 'visible'
                );
                sceneRef.current.resize(currentWidth, currentHeight);
                sceneRef.current.setReduceMotion(currentReduceMotion);
                setRenderStatus('ready');
            } catch {
                if (app) {
                    safelyDestroyApplication(app);
                }

                if (!disposed) {
                    setRenderStatus('fallback');
                }
            }
        };

        void initialize();

        return () => {
            disposed = true;
            sceneRef.current?.destroy();
            sceneRef.current = null;
        };
    }, [menuFieldTiltRef]);

    useEffect(() => {
        sceneRef.current?.resize(width, height);
    }, [height, width]);

    useEffect(() => {
        sceneRef.current?.setReduceMotion(reduceMotion);
    }, [reduceMotion]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const sync = (): void => {
            sceneRef.current?.setPageVisibilityPaused(document.visibilityState !== 'visible');
        };

        sync();
        document.addEventListener('visibilitychange', sync);

        return () => {
            document.removeEventListener('visibilitychange', sync);
        };
    }, []);

    return (
        <div className={styles.atmosphereLayer}>
            <div aria-hidden="true" className={styles.atmosphereHost} data-render-status={renderStatus} ref={hostRef}>
                {renderStatus !== 'ready' &&
                    (suppressLoadingFallback ? (
                        <div className={styles.atmospherePlaceholder} />
                    ) : (
                        <div className={styles.atmosphereFallback} />
                    ))}
            </div>
        </div>
    );
};

export default MainMenuBackground;
