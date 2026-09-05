import { describe, expect, it } from 'vitest';
import { FLOOR_CURIOS, getFloorCurio } from '../../shared/floor-curio-rules';
import { buildCodexResidentRows } from '../components/codexScreenModel';
import { FLOOR_CURIO_COPY, floorCurioAnnouncement, floorClearResidentLine } from './floorCurioBeat';

describe('meeting a resident', () => {
    it('names them and keeps their own voice on the floor-clear note', () => {
        const rat = getFloorCurio('hoarding_rat')!;
        const line = floorClearResidentLine(rat);

        expect(line).toContain(FLOOR_CURIO_COPY.downstairsPrefix);
        expect(line).toContain(rat.name);
        expect(line).toContain(rat.line);
    });

    it('drops the voice and states the change for a screen reader, which gets one pass', () => {
        const skull = getFloorCurio('gossiping_skull')!;
        const spoken = floorCurioAnnouncement(skull);

        expect(spoken).toContain(skull.name);
        expect(spoken).toContain(skull.effectSummary);
        // The joke is in `line`, and a listener cannot re-read it to find the mechanic inside.
        expect(spoken).not.toContain(skull.line);
    });

    it('reads as a sentence for every resident, not a template with a name dropped in', () => {
        for (const resident of FLOOR_CURIOS) {
            expect(floorClearResidentLine(resident)).toMatch(/[.!]$/u);
            expect(floorCurioAnnouncement(resident)).toMatch(/[.!]$/u);
        }
    });
});

describe('the Codex knows the cast', () => {
    it('lists every resident, so a player can learn who lives down there', () => {
        const rows = buildCodexResidentRows();

        for (const resident of FLOOR_CURIOS) {
            const row = rows.find((entry) => entry.id === resident.id);
            expect(row, `no Codex entry for ${resident.id}`).toBeTruthy();
            expect(row!.title).toBe(resident.name);
            expect(row!.description).toContain(resident.effectSummary);
        }
    });

    it('opens with the article that says every floor has someone on it', () => {
        expect(buildCodexResidentRows()[0]).toMatchObject({
            id: 'floor_residents',
            title: FLOOR_CURIO_COPY.codexTitle
        });
    });
});
