import { describe, expect, it } from 'vitest';
import {
    DEFAULT_BAKE_DEV_SERVER_PORT,
    parseBakeProceduralIllustrationSetArgs
} from '../../scripts/bake-procedural-illustration-set-options';

describe('parseBakeProceduralIllustrationSetArgs', () => {
    it('accepts valid TCP ports', () => {
        expect(parseBakeProceduralIllustrationSetArgs(['--port=4102']).port).toBe(4102);
    });

    it('falls back when the port is malformed or outside the TCP range', () => {
        expect(parseBakeProceduralIllustrationSetArgs(['--port=garbage']).port).toBe(DEFAULT_BAKE_DEV_SERVER_PORT);
        expect(parseBakeProceduralIllustrationSetArgs(['--port=70000']).port).toBe(DEFAULT_BAKE_DEV_SERVER_PORT);
        expect(parseBakeProceduralIllustrationSetArgs(['--port=5173.5']).port).toBe(DEFAULT_BAKE_DEV_SERVER_PORT);
    });
});
