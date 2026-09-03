import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game';
import {
    chargeFieldsWithATool,
    RUN_SHELL_TOOL_CATALOG,
    runShellToolIds,
    type RunPowerChargeField
} from './runShellToolCatalog';

/**
 * Row shuffle spent a long time with working rules, a working command, working store actions and
 * no button, because the dock is assembled inline and nothing stated what it was supposed to
 * contain. These tests are that statement, checked two ways: against the charge fields a run can
 * actually hold, and against the component that builds the dock.
 */
const GAME_SCREEN = readFileSync(join(process.cwd(), 'src/renderer/components/GameScreen.tsx'), 'utf8');

describe('the run dock catalog', () => {
    it('gives every power charge a run can hold a tool that spends it', () => {
        const run = createNewRun(0);
        const chargeFields = (Object.keys(run) as (keyof typeof run)[]).filter(
            (key) => typeof key === 'string' && key.endsWith('Charges')
        );
        const covered = new Set<string>(chargeFieldsWithATool());

        expect(chargeFields.length).toBeGreaterThan(0);
        for (const field of chargeFields) {
            // A charge a run accumulates with no tool to spend it is a power the player cannot use,
            // however complete the rules behind it are.
            expect(covered.has(field), `${field} has no dock tool that spends it`).toBe(true);
        }
    });

    it('does not name a charge field that does not exist on a run', () => {
        const run: Record<string, unknown> = { ...createNewRun(0) };
        for (const field of chargeFieldsWithATool()) {
            expect(typeof run[field as RunPowerChargeField], `${field} is not a field on RunState`).toBe('number');
        }
    });

    it('keeps ids unique and labels non-empty', () => {
        const ids = runShellToolIds();

        expect(new Set(ids).size).toBe(ids.length);
        expect(RUN_SHELL_TOOL_CATALOG.every((tool) => tool.label.trim().length > 0)).toBe(true);
    });

    it('is what the dock is actually built from', () => {
        // The catalog is only worth anything while the component reads it. If the dock goes back to
        // hardcoding ids, a tool can be dropped again without this file noticing.
        for (const id of runShellToolIds()) {
            expect(GAME_SCREEN, `the dock does not build "${id}" from the catalog`).toContain(`toolSpec('${id}')`);
        }
        expect(GAME_SCREEN).not.toMatch(/^\s+id: '(shuffle|swap|row|pin|destroy|peek|flash|stray|undo)',$/mu);
    });

    it('marks exactly the tools that are not always offered', () => {
        // Flash pair only carries charges in Practice and Wild runs; everything else is always
        // present, disabled with a reason when it cannot be used.
        expect(RUN_SHELL_TOOL_CATALOG.filter((tool) => tool.conditional).map((tool) => tool.id)).toEqual(['flash']);
    });
});
