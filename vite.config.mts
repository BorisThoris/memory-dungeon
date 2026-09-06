import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';
import { buildContentSecurityPolicy } from './src/shared/content-security-policy';
/* Plain ESM helper (`.mjs`); no `allowJs` typings -- Vite load-time only. */
// @ts-expect-error TS7016
import { viteDevBlueprintApi } from './scripts/vite-dev-blueprint-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Renderer bundle dir; override when `dist` is locked on Windows (`yarn build:renderer:alt-out`). Electron `loadFile` still expects `dist` for release builds. */
const rendererOutDir = (process.env.VITE_OUT_DIR ?? 'dist').trim() || 'dist';

const boardWebglPerfSample = path.resolve(__dirname, 'src/renderer/dev/boardWebglPerfSample.ts');
const boardWebglPerfSampleStub = path.resolve(__dirname, 'src/renderer/dev/boardWebglPerfSample.stub.ts');

/**
 * The policy in `index.html` is a placeholder so the shipped one can differ from the served one.
 * Vite copies the HTML verbatim, so a dev allowance written into the file ships with the game.
 */
const injectContentSecurityPolicy = (isDevServer: boolean) => ({
    name: 'memory-dungeon-content-security-policy',
    transformIndexHtml: {
        order: 'pre' as const,
        handler: (html: string): string =>
            html.replace('%CONTENT_SECURITY_POLICY%', buildContentSecurityPolicy({ allowDevServer: isDevServer }))
    }
});

const pruneWipPublicAssetsFromBuild = () => ({
    name: 'memory-dungeon-prune-wip-public-assets',
    closeBundle(): void {
        if (process.env.VITE_KEEP_WIP_PUBLIC_ASSETS === '1') return;
        fs.rmSync(path.resolve(__dirname, rendererOutDir, 'wip-assets'), { recursive: true, force: true });
    }
});

export default defineConfig(({ mode }) => ({
    plugins: [
        injectContentSecurityPolicy(mode !== 'production'),
        viteDevBlueprintApi(),
        pruneWipPublicAssetsFromBuild(),
        react(),
        process.env.VITE_BUNDLE_ANALYZE === '1'
            ? visualizer({
                  filename: 'dist-bundle-report.html',
                  gzipSize: true,
                  brotliSize: true,
                  template: 'treemap'
              })
            : null
    ],
    resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
            ...(mode === 'production'
                ? {
                      /* Dev perf harness: swap to no-op so prod bundle omits sampling logic. */
                      [boardWebglPerfSample]: boardWebglPerfSampleStub
                  }
                : {}),
            // Vendored notifications + zustand: force one React for Vitest + Vite.
            react: path.resolve(__dirname, 'node_modules/react'),
            'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
            zustand: path.resolve(__dirname, 'node_modules/zustand'),
            '@cross-repo-libs/notifications/styles.css': path.resolve(
                __dirname,
                'packages/notifications/src/notification-host.css'
            ),
            '@cross-repo-libs/notifications': path.resolve(
                __dirname,
                'packages/notifications/src/index.ts'
            )
        }
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        /*
         * Playwright runs against this dev server. Hot reload navigates the page whenever a file
         * changes, and a test mid-flip reads that as "execution context destroyed"; a run that
         * overlaps any editing is a run that fails for no reason the app has. The e2e web server
         * sets E2E_DISABLE_HMR=1, so each test still loads the latest code on its own navigation
         * and nothing reloads under it.
         */
        hmr: process.env.E2E_DISABLE_HMR === '1' ? false : undefined,
        watch: {
            ignored: ['**/.codex-run/**', '**/output/**', '**/release/**', '**/dist/**', '**/dist-build/**', '**/dist-electron/**']
        }
    },
    test: {
        environment: 'happy-dom',
        setupFiles: './vitest.setup.ts',
        testTimeout: 10_000,
        restoreMocks: true,
        clearMocks: true,
        /* Windows / sandbox: fork pool teardown can throw EPERM on process.kill; threads avoid it. */
        pool: 'threads',
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'packages/notifications/src/**/*.{test,spec}.{ts,tsx}'
        ]
    },
    build: {
        outDir: rendererOutDir,
        sourcemap: process.env.VITE_SOURCEMAP === '1',
        // Keep the advisory threshold aligned with the enforced main-chunk budget.
        chunkSizeWarningLimit: 1450,
        /**
         * Windows: locked files under `dist` cause EPERM on clean or on writing the same asset name.
         * Use `yarn build:renderer:alt-out` (writes to `dist-build`), or set `VITE_SKIP_EMPTY_OUT_DIR=1`
         * only when empty fails but writes succeed.
         */
        emptyOutDir: process.env.VITE_SKIP_EMPTY_OUT_DIR !== '1',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html')
            },
            output: {
                manualChunks(id: string): string | undefined {
                    if (id.includes('node_modules/three')) {
                        return 'vendor-three';
                    }
                    if (id.includes('node_modules/@react-three/fiber') || id.includes('node_modules/@react-three/drei')) {
                        return 'vendor-r3f';
                    }
                    if (id.includes('node_modules/pixi.js')) {
                        return 'vendor-pixi';
                    }
                    return undefined;
                }
            }
        }
    }
}));
