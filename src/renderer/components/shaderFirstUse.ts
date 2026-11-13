import type { Material, WebGLRenderer } from 'three';

/**
 * A warmed shader program's first use, done before play needs it (2026-11-13).
 *
 * `renderer.compile` hands the driver a program to link, but three reads it back (its info log,
 * its uniform locations) only the first time something draws with it, and that read waits for the
 * link to finish. On a Mali-G57 tablet the link was still pending at the first flip and the first
 * match, whose frames stalled about 70ms in `getProgramInfoLog` under `getUniforms` although every
 * program had been compiled with the board. This waits, off the frame, until the driver says each
 * program is linked (`isReady`, which never blocks where `KHR_parallel_shader_compile` exists), then
 * does that first read while the board is still loading. Without the extension a program reports
 * ready at once and is read at once: the wait moves into the board's load, which is the point.
 */
interface WarmableProgram {
    isReady(): boolean;
    getUniforms(): unknown;
}

/** Give up on a program that never reports ready (a lost context) after this many looks. */
export const SHADER_FIRST_USE_MAX_LOOKS = 300;

export const finishShaderProgramsOffFrame = (
    renderer: Pick<WebGLRenderer, 'properties'>,
    materials: Iterable<Material>,
    schedule: (step: () => void) => void = (step) => setTimeout(step, 16)
): void => {
    const pending = new Set(materials);
    let looks = 0;
    const step = (): void => {
        looks += 1;
        for (const material of pending) {
            const program = (renderer.properties.get(material) as { currentProgram?: WarmableProgram } | undefined)?.currentProgram;
            try {
                if (!program) {
                    pending.delete(material);
                } else if (program.isReady()) {
                    program.getUniforms();
                    pending.delete(material);
                }
            } catch {
                // A program the context lost: it compiles again on its first use.
                pending.delete(material);
            }
        }
        if (pending.size > 0 && looks < SHADER_FIRST_USE_MAX_LOOKS) schedule(step);
    };
    step();
};
