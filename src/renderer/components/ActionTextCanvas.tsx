import { useEffect, useRef } from 'react';
import type { ScreenCallout } from './screenCallouts';
import { createActionTextRenderer } from './actionTextRenderer';
import styles from './ScreenCalloutQueue.module.css';

type Props = { callout: ScreenCallout | null; duration: number; reduceMotion: boolean; lowQuality: boolean };
export function ActionTextCanvas({ callout, duration, reduceMotion, lowQuality }: Props) {
    const canvas=useRef<HTMLCanvasElement>(null);
    const renderer=useRef<ReturnType<typeof createActionTextRenderer>>(null);
    useEffect(()=>{
        const element=canvas.current;if(!element)return;
        try { renderer.current=createActionTextRenderer(element); } catch { renderer.current=null; }
        const lost=(event:Event)=>{event.preventDefault();renderer.current=null;element.parentElement!.dataset.gpu='false';};
        element.addEventListener('webglcontextlost',lost);
        return ()=>{element.removeEventListener('webglcontextlost',lost);renderer.current?.dispose();renderer.current=null;};
    },[]);
    useEffect(()=>{
        const element=canvas.current;const painter=renderer.current;if(!element)return;
        const reduced=reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        element.parentElement!.dataset.gpu=String(Boolean(painter&&!reduced));
        if(!painter)return;
        if(!callout||reduced){painter.clear();return;}
        painter.set(callout,duration/1000,lowQuality);
        // Publish readable pixels immediately, even when the board delays the next GPU frame.
        painter.draw(0.08);
        let frame=0;let alive=true;const started=performance.now();
        const render=(now:number)=>{
            const age=(now-started)/1000;
            if(document.visibilityState!=='hidden')painter.draw(Math.max(0.08,age));
            if(age<duration/1000)frame=requestAnimationFrame(render);else painter.clear();
        };
        frame=requestAnimationFrame(render);
        const observer=new ResizeObserver(()=>{painter.resize();});observer.observe(element);
        void document.fonts?.ready.then(()=>{if(alive)painter.resize();});
        return ()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();painter.clear();};
    },[callout,duration,reduceMotion,lowQuality]);
    return <canvas aria-hidden="true" className={styles.effectCanvas} data-testid="action-text-canvas" ref={canvas} />;
}
