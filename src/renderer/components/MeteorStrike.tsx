import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, ShaderMaterial } from 'three';
import type { BoardState } from '../../shared/contracts';
import { getTileColumnSpacing, TILE_SPACING } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

/** One procedural impact over the original cards; its cost never depends on how many cards it clears. */
export function MeteorStrike({ board, compact, reduceMotion, time }: { board: BoardState; compact:boolean; reduceMotion:boolean; time: MutableRefObject<number> }) {
    const started = useRef<number | null>(null);
    const material = useMemo(() => new ShaderMaterial({
        transparent:true,depthWrite:false,depthTest:false,blending:AdditiveBlending,
        uniforms:{age:{value:0},calm:{value:reduceMotion?1:0}},
        vertexShader:'varying vec2 p; void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`precision highp float; varying vec2 p; uniform float age; uniform float calm;
        void main(){
            if(age>1.8){gl_FragColor=vec4(0.);return;}
            float d=length(p);float fade=exp(-age*2.7);
            float ring=exp(-abs(d-(calm>.5?.6:min(.9,age*1.5)))*45.)*fade;
            float flash=exp(-d*d*14.)*fade;
            float sparks=0.;float trail=0.;
            if(calm<.5){
                float a=atan(p.y,p.x);sparks=pow(max(0.,sin(a*17.+1.)),30.)*exp(-abs(d-age*.8)*35.)*fade;
                vec2 head=vec2(-.55,.95)*max(0.,1.-age*4.);vec2 tail=head+vec2(-.25,.43);
                vec2 line=head-tail;float t=clamp(dot(p-tail,line)/dot(line,line),0.,1.);
                trail=exp(-length(p-(tail+line*t))*100.)*t*max(0.,1.-age*3.);
            }
            vec3 fire=mix(vec3(1.,.24,.04),vec3(1.,.87,.45),clamp(flash+trail,0.,1.));
            gl_FragColor=vec4(fire,clamp(ring+flash*.75+sparks+trail,0.,1.));
        }`
    }),[reduceMotion]);
    useEffect(()=>()=>material.dispose(),[material]);
    useFrame(()=>{started.current??=time.current;material.uniforms.age!.value=time.current-started.current;});
    const impact=board.meteorImpact!;
    const x=(impact.cell%board.columns-(board.columns-1)/2)*getTileColumnSpacing(compact);
    const y=((board.rows-1)/2-Math.floor(impact.cell/board.columns))*TILE_SPACING;
    const size=(impact.radius+1)*TILE_SPACING*2.4;
    return <mesh position={[x,y,.4]} material={material} raycast={noopMeshRaycast} renderOrder={90}>
        <planeGeometry args={[size,size]} />
    </mesh>;
}
