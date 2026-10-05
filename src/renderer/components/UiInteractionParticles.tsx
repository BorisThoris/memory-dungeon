import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './UiInteractionParticles.module.css';

interface Spark { x:number; y:number; vx:number; vy:number; born:number; size:number; }
/** One bounded particle pool for controls across menus and gameplay; asleep between inputs. */
export function UiInteractionParticles({ reduceMotion, lowQuality }: { reduceMotion:boolean; lowQuality:boolean }) {
    const canvas=useRef<HTMLCanvasElement>(null);
    useEffect(()=>{
        const element=canvas.current;if(!element||reduceMotion)return;
        const ctx=element.getContext('2d');if(!ctx)return;
        let sparks:Spark[]=[];let frame=0;let width=innerWidth;let height=innerHeight;
        const resize=()=>{width=innerWidth;height=innerHeight;const dpr=Math.min(1.25,devicePixelRatio||1);element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
        resize();
        const draw=(now:number)=>{
            ctx.clearRect(0,0,width,height);sparks=sparks.filter(p=>now-p.born<560);
            for(const p of sparks){const t=(now-p.born)/560;const x=p.x+p.vx*t;const y=p.y+p.vy*t+20*t*t;const s=p.size*(1-t*.7);
                ctx.globalAlpha=(1-t)*(1-t);ctx.fillStyle=t<.25?'#fff1c4':'#e0af66';
                ctx.beginPath();ctx.moveTo(x,y-s*2);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s*2);ctx.lineTo(x-s,y);ctx.closePath();ctx.fill();
            }
            ctx.globalAlpha=1;element.dataset.liveParticles=String(sparks.length);
            frame=sparks.length?requestAnimationFrame(draw):0;
        };
        const emit=(event:MouseEvent|PointerEvent)=>{
            if(document.visibilityState==='hidden')return;
            const control=event.target instanceof Element?event.target.closest<HTMLElement>('button, summary, [role="tab"]'):null;
            if(!control||control.matches(':disabled,[aria-disabled="true"]'))return;
            const rect=control.getBoundingClientRect();const keyboard=event.type==='click';if(keyboard&&event.detail!==0)return;
            const x=keyboard?rect.left+rect.width/2:event.clientX;const y=keyboard?rect.top+rect.height/2:event.clientY;
            const count=lowQuality?8:16;const born=performance.now();
            for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const speed=18+(i%5)*8;sparks.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-12,born,size:1.2+(i%3)*.6});}
            sparks=sparks.slice(-64);if(!frame)frame=requestAnimationFrame(draw);
        };
        const hide=()=>{if(document.visibilityState==='hidden'){cancelAnimationFrame(frame);frame=0;sparks=[];element.dataset.liveParticles='0';ctx.clearRect(0,0,width,height);}};
        document.addEventListener('pointerdown',emit,{passive:true});document.addEventListener('click',emit,{passive:true});document.addEventListener('visibilitychange',hide);window.addEventListener('resize',resize);
        return ()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',emit);document.removeEventListener('click',emit);document.removeEventListener('visibilitychange',hide);window.removeEventListener('resize',resize);};
    },[reduceMotion,lowQuality]);
    return reduceMotion?null:createPortal(<canvas aria-hidden="true" className={styles.canvas} data-testid="ui-interaction-particles" ref={canvas}/>,document.body);
}
