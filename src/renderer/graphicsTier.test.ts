import { describe, expect, it } from 'vitest';
import { classifyGraphicsTier, type GraphicsDeviceProfile } from './graphicsTier';

const device = (renderer: string, extra: Partial<GraphicsDeviceProfile> = {}): GraphicsDeviceProfile => ({ renderer, coarsePointer: false, cores: 8, memoryGb: 8, ...extra });

describe('the graphics tier a device starts on', () => {
    it('starts software and old integrated or mobile GPUs on Low', () => {
        for (const renderer of ['Google SwiftShader', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Intel(R) HD Graphics 520', 'Mali-T880', 'Adreno (TM) 506', 'PowerVR Rogue GE8320']) {
            expect(classifyGraphicsTier(device(renderer)), renderer).toBe('low');
        }
    });

    it('starts current discrete and Apple-silicon GPUs on High', () => {
        for (const renderer of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon RX 6700 XT', 'Apple M2', 'NVIDIA GeForce GTX 1070']) {
            expect(classifyGraphicsTier(device(renderer)), renderer).toBe('high');
        }
    });

    it('starts anything it does not know on Medium', () => {
        expect(classifyGraphicsTier(device(''))).toBe('medium');
        expect(classifyGraphicsTier(device('Intel(R) Iris(R) Xe Graphics'))).toBe('medium');
    });

    it('never starts a phone, or a device short of cores or memory, above Medium', () => {
        expect(classifyGraphicsTier(device('Adreno (TM) 740', { coarsePointer: true }))).toBe('medium');
        expect(classifyGraphicsTier(device('NVIDIA GeForce RTX 4060', { cores: 4 }))).toBe('medium');
        expect(classifyGraphicsTier(device('NVIDIA GeForce RTX 4060', { memoryGb: 2 }))).toBe('low');
    });
});
