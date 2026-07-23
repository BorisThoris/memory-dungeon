import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBakeTierTokenList, type OverlayDrawTier } from '../src/renderer/cardFace/overlayDrawTier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const DEFAULT_BAKE_DEV_SERVER_PORT = 5173;

const normalizePort = (value: number): number =>
    Number.isSafeInteger(value) && value >= 1 && value <= 65_535 ? value : DEFAULT_BAKE_DEV_SERVER_PORT;

export function parseBakeProceduralIllustrationSetArgs(argv: readonly string[]): {
    port: number;
    tiers: OverlayDrawTier[];
    includeFullCanvas: boolean;
    fixturePath: string;
    outDir: string;
} {
    let port = DEFAULT_BAKE_DEV_SERVER_PORT;
    let tiers: OverlayDrawTier[] = ['full'];
    let includeFullCanvas = false;
    let fixturePath = path.join(ROOT, 'e2e/fixtures/tile-card-face-illustration-regression.json');
    let outDir = path.join(ROOT, 'output/baked-procedural-illustrations');

    for (const arg of argv) {
        if (arg.startsWith('--port=')) {
            port = normalizePort(Number(arg.slice('--port='.length)));
        } else if (arg.startsWith('--tiers=')) {
            const raw = arg.slice('--tiers='.length);
            const parts = raw.split(',').map((s) => s.trim());
            tiers = parseBakeTierTokenList(parts);
        } else if (arg === '--include-full-canvas') {
            includeFullCanvas = true;
        } else if (arg.startsWith('--fixture=')) {
            fixturePath = path.resolve(ROOT, arg.slice('--fixture='.length));
        } else if (arg.startsWith('--out=')) {
            outDir = path.resolve(ROOT, arg.slice('--out='.length));
        }
    }

    return { port, tiers, includeFullCanvas, fixturePath, outDir };
}
