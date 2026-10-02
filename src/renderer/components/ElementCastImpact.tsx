import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, LinearFilter, type Mesh, type ShaderMaterial } from 'three';
import type { BoardState, ElementCastImpact as Impact, TileSuit } from '../../shared/contracts';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const COLORS: Record<TileSuit, string> = { ember: '#ff913c', tide: '#59d9ff', bone: '#ccefff', moss: '#99f05f' };
const NAMES: Record<TileSuit, [string, string]> = {
    ember: ['FIRE CAST', 'FIRE ERUPTION'], tide: ['WATER CAST', 'TIDAL WAVE'],
    bone: ['FROST CAST', 'DEEP FREEZE'], moss: ['GROVE CAST', 'OVERGROWTH']
};

/** One bounded texture / one draw per cast. The layer never intercepts input. */
function paintImpact(board: BoardState, impact: Impact, compact: boolean) {
    const positions = board.tiles.map((tile, index) => getTileTransform(tile, index, board.columns, board.rows, compact, false, true));
    const xs = positions.map(p => p.baseX), ys = positions.map(p => p.baseY);
    const left = Math.min(...xs) - CARD_PLANE_WIDTH * 0.9;
    const right = Math.max(...xs) + CARD_PLANE_WIDTH * 0.9;
    const bottom = Math.min(...ys) - CARD_PLANE_HEIGHT * 0.8;
    const top = Math.max(...ys) + CARD_PLANE_HEIGHT * 0.8;
    const width = right - left, height = top - bottom;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(1536 * Math.min(1, width / height));
    canvas.height = Math.round(1536 * Math.min(1, height / width));
    const ctx = canvas.getContext('2d')!;
    const px = (cell: number) => {
        const p = positions[cell] ?? positions[0]!;
        return { x: (p.baseX - left) / width * canvas.width, y: (top - p.baseY) / height * canvas.height };
    };
    const w = CARD_PLANE_WIDTH / width * canvas.width;
    const h = CARD_PLANE_HEIGHT / height * canvas.height;
    const color = COLORS[impact.suit];
    const sources = impact.sourceCells.filter(cell => positions[cell]).map(px);
    const origin = sources[0] ?? px(0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (color: string, thickness: number, draw: () => void) => {
        ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = thickness * 3;
        ctx.lineWidth = thickness; ctx.beginPath(); draw(); ctx.stroke(); ctx.shadowBlur = 0;
    };
    // Each matched card is a visible emitter, so a popped block becomes a larger spell.
    for (const source of sources) {
        const radius = w * (impact.power >= 4 ? 0.78 : 0.54);
        stroke(color, w * 0.035, () => ctx.arc(source.x, source.y, radius, 0, Math.PI * 2));
        stroke(color, w * 0.018, () => ctx.arc(source.x, source.y, radius * 1.22, 0, Math.PI * 2));
        for (let ray = 0; ray < 8; ray += 1) {
            const a = ray * Math.PI / 4;
            stroke(color, w * 0.024, () => {
                ctx.moveTo(source.x + Math.cos(a) * radius * 0.85, source.y + Math.sin(a) * radius * 0.85);
                ctx.lineTo(source.x + Math.cos(a) * radius * 1.4, source.y + Math.sin(a) * radius * 1.4);
            });
        }
    }
    const contacts = impact.contacts.slice(0, 64);
    // Projectiles have actual destinations: a counter stops the spell at a shield, kin absorbs it.
    for (const contact of contacts) {
        const p = px(contact.cell);
        const from = sources.reduce((best, s) => Math.hypot(p.x - s.x, p.y - s.y) < Math.hypot(p.x - best.x, p.y - best.y) ? s : best, origin);
        const bend = (contact.cell % 2 ? 1 : -1) * w * 0.5;
        stroke(color, w * (impact.power >= 4 ? 0.07 : 0.04), () => {
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo((from.x + p.x) / 2 + bend, (from.y + p.y) / 2 - bend, p.x, p.y);
        });
        stroke('#f1ffdf', w * 0.009, () => {
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo((from.x + p.x) / 2 + bend, (from.y + p.y) / 2 - bend, p.x, p.y);
        });
    }
    // Join receiving blocks, not just isolated cards. Never imply contact across a gap.
    for (const a of contacts) for (const b of contacts) {
        if (a.cell >= b.cell || a.group !== b.group) continue;
        const adjacent = Math.abs(Math.floor(a.cell / board.columns) - Math.floor(b.cell / board.columns)) + Math.abs(a.cell % board.columns - b.cell % board.columns) === 1;
        if (!adjacent) continue;
        const p = px(a.cell), q = px(b.cell);
        stroke(COLORS[a.suit], w * 0.10, () => { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); });
    }
    for (const contact of contacts) {
        const p = px(contact.cell);
        const responseColor = contact.outcome === 'neutralized' ? '#ffdf92' : contact.outcome === 'charged' ? '#ecffa9' : color;
        stroke(responseColor, w * 0.045, () => ctx.roundRect(p.x - w * 0.53, p.y - h * 0.52, w * 1.06, h * 1.04, w * 0.09));
        if (contact.outcome === 'neutralized') {
            stroke(responseColor, w * 0.035, () => {
                ctx.moveTo(p.x, p.y - h * 0.29); ctx.lineTo(p.x + w * 0.3, p.y - h * 0.18);
                ctx.quadraticCurveTo(p.x + w * 0.32, p.y + h * 0.14, p.x, p.y + h * 0.29);
                ctx.quadraticCurveTo(p.x - w * 0.32, p.y + h * 0.14, p.x - w * 0.3, p.y - h * 0.18); ctx.closePath();
            });
        } else if (contact.effect === 'entangled' && contact.outcome === 'affected') {
            for (let vine = 0; vine < 3; vine += 1) stroke(color, w * 0.035, () => {
                ctx.moveTo(p.x - w * 0.48, p.y + h * (0.35 - vine * 0.3));
                ctx.bezierCurveTo(p.x + w * 0.7, p.y - h * 0.55, p.x - w * 0.7, p.y + h * 0.55, p.x + w * 0.48, p.y - h * (0.35 - vine * 0.3));
            });
        } else if (contact.effect === 'ignited' && contact.outcome === 'affected') {
            for (let flame = -1; flame <= 1; flame += 1) stroke(color, w * 0.035, () => {
                const x = p.x + flame * w * 0.22;
                ctx.moveTo(x, p.y + h * 0.18);
                ctx.bezierCurveTo(x - w * 0.26, p.y, x + w * 0.08, p.y - h * 0.25, x, p.y - h * 0.4);
                ctx.bezierCurveTo(x + w * 0.32, p.y - h * 0.1, x + w * 0.2, p.y + h * 0.15, x, p.y + h * 0.18);
            });
        } else if (contact.effect === 'frozen' && contact.outcome === 'affected') {
            for (let axis = 0; axis < 6; axis += 1) stroke(color, w * 0.035, () => {
                const a = axis * Math.PI / 3, dx = Math.cos(a), dy = Math.sin(a);
                ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx * w * 0.46, p.y + dy * w * 0.46);
                for (const side of [-1, 1]) {
                    ctx.moveTo(p.x + dx * w * 0.25, p.y + dy * w * 0.25);
                    ctx.lineTo(p.x + dx * w * 0.32 - dy * w * 0.13 * side, p.y + dy * w * 0.32 + dx * w * 0.13 * side);
                }
            });
        } else if (contact.effect === 'current' && contact.outcome === 'affected') {
            for (let wave = -1; wave <= 1; wave += 1) stroke(color, w * 0.035, () => {
                const y = p.y + wave * h * 0.16;
                ctx.moveTo(p.x - w * 0.43, y);
                ctx.bezierCurveTo(p.x - w * 0.1, y - h * 0.22, p.x + w * 0.1, y + h * 0.22, p.x + w * 0.43, y);
            });
        } else {
            stroke(responseColor, w * 0.035, () => ctx.arc(p.x, p.y, w * 0.34, 0, Math.PI * 2));
        }
        const text = contact.outcome === 'charged' ? (compact ? '+1 CHARGE' : 'COMBINE +1')
            : contact.outcome === 'neutralized' ? (compact ? 'BLOCKED' : 'NEUTRALIZED')
            : compact && contact.effect === 'entangled' ? 'VINES' : (contact.effect ?? 'affected').toUpperCase();
        const font = Math.max(12, Math.floor(w * (compact ? 0.20 : 0.115)));
        ctx.font = `800 ${font}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const labelWidth = ctx.measureText(text).width + font;
        ctx.fillStyle = '#100d1a'; ctx.fillRect(p.x - labelWidth / 2, p.y + h * 0.21, labelWidth, font * 1.65);
        ctx.fillStyle = responseColor; ctx.fillText(text, p.x, p.y + h * 0.21 + font * 0.82);
    }
    const title = NAMES[impact.suit][impact.power >= 4 ? 1 : 0];
    ctx.font = `900 ${Math.round(w * 0.2)}px system-ui`; ctx.textAlign = 'center';
    ctx.shadowBlur = 14; ctx.shadowColor = '#000'; ctx.lineWidth = 7; ctx.strokeStyle = '#100b1b';
    ctx.strokeText(title, origin.x, origin.y - h * 0.1); ctx.fillStyle = '#fff5d8'; ctx.fillText(title, origin.x, origin.y - h * 0.1);
    ctx.font = `800 ${Math.round(w * 0.14)}px system-ui`;
    const sub = `×${impact.multiplier} · ${impact.contacts.filter(c => c.outcome === 'affected').length} HIT`;
    ctx.strokeText(sub, origin.x, origin.y + h * 0.09); ctx.fillStyle = color; ctx.fillText(sub, origin.x, origin.y + h * 0.09);
    if (impact.reaction) {
        ctx.strokeText(impact.reaction.toUpperCase(), origin.x, origin.y + h * 0.25);
        ctx.fillStyle = '#fff5d8'; ctx.fillText(impact.reaction.toUpperCase(), origin.x, origin.y + h * 0.25);
    }
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false;
    return { texture, width, height, x: (left + right) / 2, y: (bottom + top) / 2,
        origin: [origin.x / canvas.width, 1 - origin.y / canvas.height] };
}

const vertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment = `
uniform sampler2D uMap; uniform float uAge; uniform float uLife; uniform float uStill; uniform vec2 uOrigin;
varying vec2 vUv;
void main(){
    vec4 ink=texture2D(uMap,vUv);
    float reveal=uStill>0.5 ? 1.0 : 1.0-smoothstep(uAge*2.1,uAge*2.1+0.14,distance(vUv,uOrigin));
    float fade=1.0-smoothstep(uLife-1.2,uLife,uAge);
    float front=uStill>0.5 ? 0.0 : exp(-pow((distance(vUv,uOrigin)-uAge*0.75)*14.0,2.0));
    gl_FragColor=vec4(ink.rgb*(1.0+front*0.55),ink.a*reveal*fade*0.94);
}`;

function ImpactLayer({ board, impact, compact, reduceMotion }: { board: BoardState; impact: Impact; compact: boolean; reduceMotion: boolean }) {
    // Mounted per event, so ordinary flips do not restart the spell or recreate its texture.
    const [initial] = useState(board);
    const painting = useMemo(() => paintImpact(initial, impact, compact), [initial, impact, compact]);
    const mesh = useRef<Mesh>(null), material = useRef<ShaderMaterial>(null);
    const age = useRef(0);
    const uniforms = useMemo(() => ({ uMap: { value: painting.texture }, uAge: { value: 0 },
        uLife: { value: impact.power >= 4 ? 5.5 : 4.5 }, uStill: { value: reduceMotion ? 1 : 0 }, uOrigin: { value: painting.origin } }), [painting, impact.power, reduceMotion]);
    useEffect(() => () => painting.texture.dispose(), [painting]);
    useFrame((_state, delta) => {
        // A slow first WebGL frame must not consume the entire spell before it is ever shown.
        age.current += Math.min(delta, 0.1);
        if (material.current) material.current.uniforms.uAge!.value = age.current;
        if (mesh.current) mesh.current.visible = age.current < uniforms.uLife.value;
    });
    return <mesh ref={mesh} position={[painting.x, painting.y, 0.35]} raycast={noopMeshRaycast} renderOrder={40}>
        <planeGeometry args={[painting.width, painting.height]} />
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>;
}

export function ElementCastImpact({ board, compact, reduceMotion }: { board: BoardState; compact: boolean; reduceMotion: boolean }) {
    return board.elementCast ? <ImpactLayer key={board.elementCast.key} board={board} impact={board.elementCast} compact={compact} reduceMotion={reduceMotion} /> : null;
}
