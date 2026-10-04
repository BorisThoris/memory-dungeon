import { fieldCellAlive, type CardField } from '../../shared/card-field';
import type { GodFieldEffect } from '../../shared/god-run-engine';

export interface FieldView { zoom: number; x: number; y: number }
export interface FieldFrame { field: CardField; view: FieldView; effects: readonly GodFieldEffect[]; clockMs: number; reduced: boolean; low: boolean; target: readonly [number, number] }
const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){ uv=vec2(position.x*.5+.5,.5-position.y*.5); gl_Position=vec4(position,0.,1.); }`;
const fragment = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
in vec2 uv; out vec4 outColor;
uniform usampler2D alive;
uniform uvec4 mapping;
uniform vec2 grid, pixels, center, target;
uniform float zoom, time, reduced;
uniform vec4 impacts[8];
uniform float kinds[8];
float liveAt(vec2 at){
 if(any(lessThan(at,vec2(0.)))||any(greaterThanEqual(at,grid))) return 0.;
 uvec2 cell=uvec2(floor(at)); uint id=cell.y*uint(grid.x)+cell.x;
 uint pair=id<mapping.x?id:((id-mapping.x)*mapping.y+mapping.z)&(mapping.x-1u);
 uint word=pair>>5u; uint bits=texelFetch(alive,ivec2(word%mapping.w,word/mapping.w),0).r;
 return float((bits>>(pair&31u))&1u);
}
void main(){
 vec2 p=(uv-.5)*grid/zoom+center*grid;
 vec2 footprint=grid/(pixels*zoom);
 float detail=clamp(1./max(footprint.x,footprint.y),0.,1.);
 float living=(liveAt(p)+liveAt(p+footprint*vec2(.37,.19))+liveAt(p+footprint*vec2(-.31,.41))+liveAt(p+footprint*vec2(.21,-.43)))*.25;
 vec2 f=abs(fract(p)-.5);
 float card=1.-smoothstep(.35,.48,max(f.x,f.y));
 float grain=fract(sin(dot(floor(p),vec2(12.9898,78.233)))*43758.5453);
 vec3 base=mix(vec3(.035,.04,.095),vec3(.08,.12,.2),uv.y);
 vec3 ink=mix(vec3(.12,.48,.6),vec3(.6,.37,.85),grain);
 float rune=(1.-smoothstep(.045,.08,abs(f.x+f.y-.23)))*detail;
 vec3 col=base+living*(ink*(mix(.8,card,detail))+.18*rune);
 for(int i=0;i<8;i++){
  float age=time-impacts[i].w;
  if(age>=0.&&age<2.){
   float radius=max(impacts[i].z,1.); float d=length(p-impacts[i].xy)/radius;
   float t=reduced>.5?1.:min(1.,age*2.);
   float ring=exp(-abs(d-t)*25.)*(1.-age*.5);
   float glow=exp(-d*d*5.)*exp(-age*3.);
   vec3 fire=kinds[i]>1.5?vec3(.25,.65,1.):vec3(1.,.5,.12);
   col+=fire*(ring*.85+glow*.7);
   if(reduced<.5&&kinds[i]<1.5){
    if(age<.32){
     vec2 direction=vec2(.55,.84);
     vec2 head=impacts[i].xy-direction*radius*(1.-age/.32)*2.;
     vec2 tail=head-direction*radius*.9;
     vec2 segment=head-tail;
     float along=clamp(dot(p-tail,segment)/max(.001,dot(segment,segment)),0.,1.);
     float trail=exp(-length(p-(tail+along*segment))/max(.4,radius*.024));
     col+=vec3(1.,.78,.4)*trail*along*1.6;
    }
    vec2 spark=p-impacts[i].xy; float angle=atan(spark.y,spark.x);
    float rays=pow(max(0.,sin(angle*13.+kinds[i])),26.);
    col+=fire*rays*exp(-abs(d-age*1.4)*18.)*exp(-age*2.);
   }
  }
 }
 vec2 aim=(p-target)*zoom/grid*pixels;
 float reticle=(1.-smoothstep(1.,2.,abs(length(aim)-12.)))+float(abs(aim.x)<1.&&abs(aim.y)<18.)+float(abs(aim.y)<1.&&abs(aim.x)<18.);
 col=mix(col,vec3(1.,.85,.5),min(.85,reticle*.8));
 col*=1.-.3*length(uv-.5);
 outColor=vec4(col,1.);
}`;

/** Two triangles, one integer texture and at most eight effects, independent of card population. */
export const createGodFieldRenderer = (canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return null;
    const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message ?? 'Field shader compilation failed'); }
        return shader;
    };
    const program = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Field shader link failed');
    const vao = gl.createVertexArray()!, buffer = gl.createBuffer()!, texture = gl.createTexture()!;
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const names = ['alive','mapping','grid','pixels','center','target','zoom','time','reduced','impacts','kinds'] as const;
    const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)])) as Record<typeof names[number], WebGLUniformLocation>;
    let priorWords: readonly number[] | null = null;
    let upload = new Uint32Array(0);
    canvas.dataset.renderer = 'webgl2'; canvas.dataset.drawCalls = '1'; canvas.dataset.triangles = '2';
    return {
        draw(frame: FieldFrame) {
            const { field, view } = frame;
            const rect = canvas.getBoundingClientRect(), cap = frame.low ? 800 : 1400;
            const scale = Math.min(frame.low ? 1 : window.devicePixelRatio, cap / Math.max(1, rect.width));
            const width = Math.max(1, Math.round(rect.width * scale)), height = Math.max(1, Math.round(rect.height * scale));
            if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
            const tw = Math.min(1024, field.aliveWords.length), th = Math.ceil(field.aliveWords.length / tw);
            gl.useProgram(program); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
            if (priorWords !== field.aliveWords) {
                if (upload.length !== tw * th) upload = new Uint32Array(tw * th);
                upload.set(field.aliveWords);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, tw, th, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, upload);
                priorWords = field.aliveWords;
            }
            gl.viewport(0, 0, width, height); gl.uniform1i(uniforms.alive, 0);
            gl.uniform4ui(uniforms.mapping, field.pairCapacity, field.permutation, field.permutationOffset, tw);
            gl.uniform2f(uniforms.grid, field.columns, field.rows); gl.uniform2f(uniforms.pixels, width, height);
            gl.uniform2f(uniforms.center, view.x, view.y); gl.uniform2f(uniforms.target, frame.target[0], frame.target[1]);
            gl.uniform1f(uniforms.zoom, view.zoom); gl.uniform1f(uniforms.time, frame.clockMs / 1000); gl.uniform1f(uniforms.reduced, frame.reduced ? 1 : 0);
            const impacts = new Float32Array(32), kinds = new Float32Array(8);
            for (let i = 0; i < 8; i++) {
                const effect = frame.effects[i];
                impacts.set(effect ? [effect.x,effect.y,effect.radius,effect.atMs/1000] : [0,0,0,-100], i*4);
                kinds[i] = effect?.kind === 'meteor' || effect?.kind === 'echo' ? 1 : 2;
            }
            gl.uniform4fv(uniforms.impacts, impacts); gl.uniform1fv(uniforms.kinds, kinds); gl.drawArrays(gl.TRIANGLES, 0, 6);
            canvas.dataset.cards = String(field.livePairs * 2);
        },
        dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); }
    };
};

/** Pixel-bounded fallback samples the same live cells; no per-card objects or animations. */
export const drawGodFieldFallback = (canvas: HTMLCanvasElement, frame: FieldFrame) => {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = 320; canvas.height = 180;
    ctx.fillStyle = '#101328'; ctx.fillRect(0,0,320,180);
    for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
        const cx = Math.floor(((x / 160 - .5) / frame.view.zoom + frame.view.x) * frame.field.columns);
        const cy = Math.floor(((y / 90 - .5) / frame.view.zoom + frame.view.y) * frame.field.rows);
        if (cx < 0 || cy < 0 || cx >= frame.field.columns || cy >= frame.field.rows || !fieldCellAlive(frame.field, cy * frame.field.columns + cx)) continue;
        ctx.fillStyle = (cx + cy) % 3 ? '#447e99' : '#956eb8'; ctx.fillRect(x*2,y*2,2,2);
    }
    const tx = ((frame.target[0]/frame.field.columns-frame.view.x)*frame.view.zoom+.5)*320;
    const ty = ((frame.target[1]/frame.field.rows-frame.view.y)*frame.view.zoom+.5)*180;
    ctx.strokeStyle = '#ffe3a2'; ctx.beginPath(); ctx.arc(tx,ty,7,0,Math.PI*2); ctx.stroke();
    canvas.dataset.renderer = 'canvas2d'; canvas.dataset.cards = String(frame.field.livePairs * 2);
};
