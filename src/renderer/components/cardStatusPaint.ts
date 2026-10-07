import { TILE_SUIT_CATALOG } from '../../shared/tile-suit-rules';
import { cardStatusBlocksTurning, type RealmTileMark } from './realmTileMarkKey';

const W = 256;
const H = 374;
const INK = '#10191f';
const PAPER = '#fff2ce';

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 12): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
};

const outlined = (ctx: CanvasRenderingContext2D, fill: string, width = 10): void => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.fill();
};

/** A geometric lock, not a font glyph: its silhouette survives a 16px atlas slot. */
const lock = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 27;
    ctx.beginPath(); ctx.arc(0, -17, 26, Math.PI, 0); ctx.lineTo(26, 14); ctx.stroke();
    ctx.strokeStyle = PAPER; ctx.lineWidth = 13; ctx.stroke();
    rect(ctx, -43, 0, 86, 67, 8); outlined(ctx, PAPER, 12);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(0, 25, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-6, 25, 12, 24);
    ctx.restore();
};

const badge = (ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number): void => {
    rect(ctx, x - 47, y - 30, 94, 60, 10);
    outlined(ctx, INK, 7);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = color; ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(text, x, y + 2);
};

/**
 * Read order: blocked silhouette + lock, element/identity, secondary benefit, decoration.
 * All persistent information is opaque, outlined, and independent of lighting or animation.
 * Detailed meshes and tiny atlas slots call this same painter; scale removes detail, not state.
 */
export const paintCardStatus = (
    ctx: CanvasRenderingContext2D, width: number, height: number, mark: RealmTileMark, faceUp = false
): void => {
    ctx.save();
    ctx.scale(width / W, height / H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const blocked = cardStatusBlocksTurning(mark);

    if (mark.snowed && !faceUp) {
        rect(ctx, 8, 8, W - 16, H - 16, 18); outlined(ctx, '#46545e');
        ctx.fillStyle = '#ecf5fc'; ctx.font = 'bold 140px system-ui, sans-serif';
        ctx.fillText('?', W / 2, H * 0.45);
    }
    if (blocked && !faceUp) {
        rect(ctx, 6, 6, W - 12, H - 12, 16);
        ctx.fillStyle = '#0d141b70'; ctx.fill();
    }
    if (mark.frost > 0) {
        // Broad, broken edges identify ice even in grayscale; benefits never use this silhouette.
        for (const side of [0, 1]) {
            ctx.save();
            if (side) { ctx.translate(W, H); ctx.rotate(Math.PI); }
            ctx.beginPath();
            ctx.moveTo(4, 26); ctx.lineTo(37, 8); ctx.lineTo(51, 70); ctx.lineTo(29, 100);
            ctx.lineTo(53, 138); ctx.lineTo(30, 174); ctx.lineTo(49, 229); ctx.lineTo(25, 259);
            ctx.lineTo(42, 310); ctx.lineTo(9, 360); ctx.lineTo(1, 317); ctx.closePath();
            outlined(ctx, '#a6dae8', 12);
            ctx.strokeStyle = '#ecfcff'; ctx.lineWidth = 5; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(13, 62); ctx.lineTo(31, 137); ctx.lineTo(14, 214);
            ctx.strokeStyle = '#50788d'; ctx.lineWidth = 7; ctx.stroke();
            ctx.restore();
        }
        badge(ctx, String(mark.frost), '#d7f6ff', W - 58, 46);
    }
    if (mark.vined) {
        // Two heavy straps cross the card, with a dark outer cut and a light face.
        for (const reverse of [false, true]) {
            ctx.beginPath();
            ctx.moveTo(8, reverse ? H * 0.70 : H * 0.25);
            ctx.bezierCurveTo(W * 0.34, H * 0.50, W * 0.67, H * 0.46, W - 8, reverse ? H * 0.25 : H * 0.70);
            ctx.strokeStyle = INK; ctx.lineWidth = faceUp ? 25 : 39; ctx.stroke();
            ctx.strokeStyle = '#aec981'; ctx.lineWidth = faceUp ? 16 : 27; ctx.stroke();
            ctx.strokeStyle = '#e9edb1'; ctx.lineWidth = 5; ctx.stroke();
        }
        for (const [x, y, angle] of [[16, 104, -0.7], [W - 16, 105, 0.7], [15, 262, -0.5], [W - 16, 262, 0.5]]) {
            ctx.save(); ctx.translate(x!, y!); ctx.rotate(angle!);
            ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(30, 0, 0, 25);
            ctx.quadraticCurveTo(-22, 0, 0, -30); outlined(ctx, '#b8d18d', 8); ctx.restore();
        }
    }
    if (mark.openingLocked && !mark.vined && !mark.frost) {
        rect(ctx, 2, H * 0.38, W - 4, 44, 6); outlined(ctx, '#d1a378', 10);
    }
    if (mark.fuse > 0) {
        // Fire is a hazard, not a lock: upward tongues and a countdown, without the lock seal.
        for (const side of [0, 1]) {
            ctx.save();
            if (side) { ctx.translate(W, 0); ctx.scale(-1, 1); }
            ctx.beginPath(); ctx.moveTo(5, H - 28); ctx.lineTo(5, H - 130);
            ctx.quadraticCurveTo(40, H - 175, 24, H - 232);
            ctx.quadraticCurveTo(89, H - 148, 47, H - 37); ctx.closePath();
            outlined(ctx, '#ee9c4e', 9);
            ctx.fillStyle = '#ffe8a3'; ctx.beginPath(); ctx.moveTo(17, H - 45);
            ctx.quadraticCurveTo(21, H - 103, 43, H - 129); ctx.lineTo(35, H - 44); ctx.fill();
            ctx.restore();
        }
        badge(ctx, String(mark.fuse), '#ffd098', mark.frost ? 58 : W - 58, 46);
    }
    if (blocked) {
        const y = faceUp ? H * 0.75 : H * 0.70;
        lock(ctx, W / 2, y, faceUp ? 65 : 100);
        // Text supports the symbol at close zoom, but is never the only identifier.
        rect(ctx, 28, H - 47, W - 56, 40, 5); ctx.fillStyle = INK; ctx.fill();
        ctx.fillStyle = PAPER; ctx.font = 'bold 32px system-ui, sans-serif';
        ctx.fillText(mark.vined ? 'BOUND' : mark.frost ? 'FROZEN' : 'WAIT', W / 2, H - 26);
    } else if (mark.rime) {
        // Protection uses a shield, not the ice-lock geometry.
        ctx.beginPath(); ctx.moveTo(95, H - 87); ctx.lineTo(161, H - 87); ctx.lineTo(157, H - 45);
        ctx.lineTo(128, H - 22); ctx.lineTo(99, H - 45); ctx.closePath(); outlined(ctx, '#b3d8e4', 8);
        ctx.strokeStyle = INK; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(111, H - 59); ctx.lineTo(123, H - 47); ctx.lineTo(145, H - 71); ctx.stroke();
    }
    if (mark.seeded && !blocked) {
        // Rewards are compact and round; never the full-card crossing used for a hold.
        badge(ctx, `+${mark.seeded}`, '#d1e5a5', mark.rime ? 58 : W / 2, mark.rime ? H - 127 : H - 49);
    }
    if (mark.bloom) badge(ctx, '+3', '#ffe2a0', mark.turncoat ? W / 2 : 58, mark.frost && mark.fuse ? 119 : 46);
    if (mark.turncoat) {
        // The Turncoat's dog-ear: the corner already turned to what the card will be next, in that
        // element's colour and rune, with the arrow of a turn. A shape no realm mark uses.
        const next = TILE_SUIT_CATALOG[mark.turncoat];
        ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(132, 6); ctx.lineTo(6, 132); ctx.closePath();
        outlined(ctx, next.hue, 9);
        ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = 'bold 50px system-ui, "Segoe UI Symbol", sans-serif';
        ctx.fillText(next.rune, 44, 46);
        ctx.strokeStyle = INK; ctx.lineWidth = 15;
        ctx.beginPath(); ctx.arc(74, 74, 76, -0.2, Math.PI / 2 + 0.2); ctx.stroke();
        ctx.strokeStyle = PAPER; ctx.lineWidth = 7; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(148, 40); ctx.lineTo(168, 72); ctx.lineTo(130, 72); ctx.closePath();
        outlined(ctx, PAPER, 6);
    }
    if (mark.hourglass) {
        // The Hourglass: two gold triangles tip to tip and the turns of sand left, low on the left.
        const x = 54; const y = H - 62;
        rect(ctx, x - 46, y - 50, 124, 100, 12); outlined(ctx, INK, 7);
        ctx.strokeStyle = '#ffd766'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 30, y - 34); ctx.lineTo(x + 14, y - 34); ctx.lineTo(x - 8, y); ctx.lineTo(x + 14, y + 34); ctx.lineTo(x - 30, y + 34); ctx.lineTo(x - 8, y); ctx.closePath();
        ctx.fillStyle = '#ffd766'; ctx.fill();
        ctx.font = 'bold 56px system-ui, sans-serif';
        ctx.fillText(String(mark.hourglass), x + 48, y + 3);
    }
    ctx.restore();
};
