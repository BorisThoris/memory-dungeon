import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';
/* Plain ESM helper (`.mjs`); no `allowJs` typings -- Vite load-time only. */
// @ts-expect-error TS7016
import { viteDevBlueprintApi } from './scripts/vite-dev-blueprint-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Renderer bundle dir; override when `dist` is locked on Windows (`yarn build:renderer:alt-out`). Electron `loadFile` still expects `dist` for release builds. */
const rendererOutDir = (process.env.VITE_OUT_DIR ?? 'dist').trim() || 'dist';

const boardWebglPerfSample = path.resolve(__dirname, 'src/renderer/dev/boardWebglPerfSample.ts');
const boardWebglPerfSampleStub = path.resolve(__dirname, 'src/renderer/dev/boardWebglPerfSample.stub.ts');

const pruneWipPublicAssetsFromBuild = () => ({
    name: 'memory-dungeon-prune-wip-public-assets',
    closeBundle(): void {
        if (process.env.VITE_KEEP_WIP_PUBLIC_ASSETS === '1') return;
        fs.rmSync(path.resolve(__dirname, rendererOutDir, 'wip-assets'), { recursive: true, force: true });
    }
});

export default defineConfig(({ mode }) => ({
    plugins: [
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
        watch: {
            ignored: ['**/.codex-run/**', '**/output/**', '**/release/**', '**/dist/**', '**/dist-build/**', '**/dist-electron/**']
        }
    },
    test: {
        environment: 'happy-dom',
        setupFiles: './vitest.setup.ts',
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
        chunkSizeWarningLimit: 1300,
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
