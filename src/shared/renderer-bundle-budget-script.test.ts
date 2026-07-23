import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'scripts', 'check-renderer-bundle-budget.mjs');
const tempRoots: string[] = [];

const makeOutputDir = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-dungeon-bundle-budget-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<div id="root"></div>');
    return root;
};

const writeSizedFile = (filePath: string, bytes: number): void => {
    fs.writeFileSync(filePath, Buffer.alloc(bytes, 'x'));
};

const runBudget = (outDir: string): string =>
    execFileSync(process.execPath, [scriptPath, outDir], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });

const runBudgetResult = (outDir: string) =>
    spawnSync(process.execPath, [scriptPath, outDir], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
    });

describe('renderer bundle budget script', () => {
    afterEach(() => {
        for (const root of tempRoots.splice(0)) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('passes a small synthetic renderer output', () => {
        const outDir = makeOutputDir();
        writeSizedFile(path.join(outDir, 'assets', 'main-test.js'), 10 * 1024);
        writeSizedFile(path.join(outDir, 'assets', 'main-test.css'), 4 * 1024);

        expect(runBudget(outDir)).toContain('Renderer bundle budget passed.');
    });

    it('fails oversized named JavaScript chunks', () => {
        const outDir = makeOutputDir();
        writeSizedFile(path.join(outDir, 'assets', 'main-oversized.js'), 1451 * 1024);

        const result = runBudgetResult(outDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('exceeds JS chunk budget');
    });

    it('fails oversized total output', () => {
        const outDir = makeOutputDir();
        writeSizedFile(path.join(outDir, 'assets', 'payload.bin'), 21 * 1024 * 1024);

        const result = runBudgetResult(outDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('total output');
    });

    it('fails oversized individual assets', () => {
        const outDir = makeOutputDir();
        writeSizedFile(path.join(outDir, 'assets', 'large-texture.png'), 2501 * 1024);

        const result = runBudgetResult(outDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('exceeds individual asset budget');
    });

    it('fails leaked design-reference WIP assets', () => {
        const outDir = makeOutputDir();
        fs.mkdirSync(path.join(outDir, 'wip-assets', 'svg'), { recursive: true });
        writeSizedFile(path.join(outDir, 'wip-assets', 'svg', 'board-reference.svg'), 1024);

        const result = runBudgetResult(outDir);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('must not ship in renderer output');
    });
});
