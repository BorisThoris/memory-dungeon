import type { ScreenCallout } from './screenCallouts';
import { layoutActionText } from './actionTextLayout';

const VERTEX = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT = `precision mediump float;
varying vec2 uv; uniform sampler2D lettering; uniform vec2 resolution; uniform vec3 tint;
uniform float age; uniform float duration; uniform float major; uniform float particles; uniform float rare;
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
void main(){
 float life=clamp(age/duration,0.,1.);
 float fade=smoothstep(0.,.08,life)*(1.-smoothstep(.73,1.,life));
 vec2 center=vec2(.5,mix(.70,.55,major));
 float impact=exp(-age*17.);
 vec2 p=uv-center;
 float aspect=resolution.x/resolution.y;
 float tilt=.035+impact*.025;
 vec2 tilted=p*vec2(aspect,1.);
 tilted=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*tilted;
 vec2 textUv=center+tilted/vec2(aspect,1.)/(1.+impact*.18);textUv.x+=p.y*.07*impact;
 vec4 glyph=texture2D(lettering,textUv);
 float sweep=exp(-pow((uv.x-(life*1.65-.2))*15.,2.));
 vec3 spectral=.65+.35*cos(vec3(0.,2.,4.)+uv.x*5.-age*4.);
 vec3 accent=mix(tint,spectral,rare*.8);
 vec3 ink=glyph.rgb*mix(accent,vec3(1.,.97,.86),.35+sweep*.65);
 vec2 q=p*vec2(resolution.x/resolution.y,1.);
 float radius=length(q);float ringRadius=.025+life*.32;
 float ring=exp(-abs(radius-ringRadius)*200.)*exp(-life*7.)*major;
 float halo=exp(-dot(q*vec2(.8,1.8),q*vec2(.8,1.8))*55.)*.16*exp(-life*4.);
 float dust=0.;
 for(int i=0;i<24;i++){
  float fi=float(i);if(fi>=particles)break;
  float angle=hash(fi+4.)*6.28318;
  float speed=.07+hash(fi+8.)*.22;
  vec2 at=vec2(cos(angle),sin(angle))*speed*(.1+age*1.5);
  at.y-=age*age*.03;
  vec2 d=q-at;d.y*=2.5;
  dust+=exp(-dot(d,d)*mix(30000.,85000.,hash(fi+2.)))*(1.-life)*.8;
 }
 float slash=exp(-abs(q.y+q.x*.10)*220.)*smoothstep(.10,.17,abs(q.x))*(1.-smoothstep(.30,.55,abs(q.x)));
 slash+=exp(-abs(q.y+q.x*.10-.055)*280.)*smoothstep(.17,.22,abs(q.x))*(1.-smoothstep(.30,.48,abs(q.x)))*.5;
 float energy=(ring*.65+halo+dust+slash*exp(-life*5.)*major)*fade;
 vec3 rgb=ink*glyph.a*fade+accent*energy;
 float alpha=clamp(glyph.a*fade+energy,0.,1.);
 gl_FragColor=vec4(rgb,alpha);
}`;
const TONES = { hot:'#ffa24f', blazing:'#ff7a3d', inferno:'#ff4d5e', legendary:'#dfb2ff', miss:'#f47b70', gold:'#f8d18d', cyan:'#8fdcff' };

/** A single retained GL context. It draws only while an event is alive and owns no input. */
export function createActionTextRenderer(canvas: HTMLCanvasElement) {
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl || typeof gl.createShader!=='function') return null;
    const shaders: WebGLShader[]=[];
    const compile=(kind:number,source:string)=>{
        const shader=gl.createShader(kind)!;gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('Action text shader could not compile');}
        shaders.push(shader);return shader;
    };
    const program=gl.createProgram()!;
    try { gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Action text shader could not link');
    } catch { shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);return null; }
    const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const location=(name:string)=>gl.getUniformLocation(program,name);
    const uniforms=Object.fromEntries(['resolution','tint','age','duration','major','particles','lettering','rare'].map(name=>[name,location(name)]));
    const art=document.createElement('canvas');const ctx=art.getContext('2d');
    let callout:ScreenCallout|null=null;let duration=1;let count=16;
    const resize=()=>{
        const rect=canvas.getBoundingClientRect();const dpr=Math.min(count===8?1:1.5,window.devicePixelRatio||1);
        const width=Math.max(1,Math.round(rect.width*dpr));const height=Math.max(1,Math.round(rect.height*dpr));
        if(!ctx||!callout)return;
        canvas.width=width;canvas.height=height;art.width=width;art.height=height;
        ctx.scale(dpr,dpr);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
        const font=(size:number,bold:boolean)=>`${bold?'italic 900':'600'} ${size}px "Source Sans 3", sans-serif`;
        const layout=layoutActionText(callout.title,callout.sub,rect.width,rect.height,callout.size==='major',(text,size,bold)=>{ctx.font=font(size,bold);return ctx.measureText(text).width;});
        const total=layout.titleLines.length*layout.lineHeight+10+layout.subtitleLines.length*layout.subtitleSize*1.3;
        let y=rect.height*(callout.size==='major'?.45:.30)-total/2+layout.lineHeight/2;
        ctx.font=font(layout.titleSize,true);ctx.fillStyle='#fff';ctx.strokeStyle='#10131d';ctx.lineWidth=6;
        for(const line of layout.titleLines){ctx.strokeText(line,rect.width/2,y);ctx.fillText(line,rect.width/2,y);y+=layout.lineHeight;}
        y+=10-layout.lineHeight/2+layout.subtitleSize/2;ctx.font=font(layout.subtitleSize,false);ctx.lineWidth=4;
        for(const line of layout.subtitleLines){ctx.strokeText(line,rect.width/2,y);ctx.fillText(line,rect.width/2,y);y+=layout.subtitleSize*1.3;}
        gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,art);
        canvas.dataset.titleLines=String(layout.titleLines.length);canvas.dataset.titleSize=String(layout.titleSize);
    };
    return {
        set(next:ScreenCallout,seconds:number,low:boolean){callout=next;duration=seconds;count=low?8:next.size==='major'?24:12;resize();},
        resize,
        draw(age:number){
            if(!callout)return;
            gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
            const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
            gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniforms.lettering!,0);
            gl.uniform2f(uniforms.resolution!,canvas.width,canvas.height);gl.uniform1f(uniforms.age!,age);gl.uniform1f(uniforms.duration!,duration);gl.uniform1f(uniforms.major!,callout.size==='major'?1:0);gl.uniform1f(uniforms.particles!,count);
            gl.uniform1f(uniforms.rare!,callout.rare?1:0);
            const hex=(callout.color??TONES[callout.tone]).replace('#','');const value=parseInt(hex.length===3?hex.split('').map(c=>c+c).join(''):hex,16);
            gl.uniform3f(uniforms.tint!,((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255);gl.drawArrays(gl.TRIANGLES,0,6);
        },
        clear(){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);},
        dispose(){gl.deleteTexture(texture);gl.deleteBuffer(buffer);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);}
    };
}
