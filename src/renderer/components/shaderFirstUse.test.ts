import { MeshBasicMaterial, type Material, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { finishShaderProgramsOffFrame, SHADER_FIRST_USE_MAX_LOOKS } from './shaderFirstUse';

const programFor = (readyAfter: number) => {
    let looks = 0;
    const program = {
        firstUses: 0,
        isReady: () => {
            looks += 1;
            return looks > readyAfter;
        },
        getUniforms: () => {
            program.firstUses += 1;
            return {};
        }
    };
    return program;
};

const rendererWith = (programs: Map<Material, unknown>) =>
    ({ properties: { get: (material: unknown) => ({ currentProgram: programs.get(material as Material) }) } }) as unknown as Pick<WebGLRenderer, 'properties'>;

describe('a warmed shader program is first used before play', () => {
    it('reads each program once, as soon as the driver says it is linked, and never before', () => {
        const linked = programFor(0);
        const linking = programFor(2);
        const a = new MeshBasicMaterial();
        const b = new MeshBasicMaterial();
        const steps: Array<() => void> = [];
        finishShaderProgramsOffFrame(rendererWith(new Map<Material, unknown>([[a, linked], [b, linking]])), [a, b], (step) => steps.push(step));
        // The linked one is read at once; the other waits, off the frame, rather than blocking on its link.
        expect(linked.firstUses).toBe(1);
        expect(linking.firstUses).toBe(0);
        steps.shift()!();
        expect(linking.firstUses).toBe(0);
        steps.shift()!();
        expect(linking.firstUses).toBe(1);
        expect(linked.firstUses).toBe(1);
        expect(steps).toHaveLength(0);
    });

    it('stops looking at a program that never links, and skips a material with no program', () => {
        const never = programFor(Number.POSITIVE_INFINITY);
        const material = new MeshBasicMaterial();
        let scheduled = 0;
        const steps: Array<() => void> = [];
        finishShaderProgramsOffFrame(rendererWith(new Map<Material, unknown>([[material, never]])), [material, new MeshBasicMaterial()], (step) => {
            scheduled += 1;
            steps.push(step);
        });
        while (steps.length > 0) steps.shift()!();
        expect(scheduled).toBe(SHADER_FIRST_USE_MAX_LOOKS - 1);
        expect(never.firstUses).toBe(0);
    });
});
