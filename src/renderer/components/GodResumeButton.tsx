import { useEffect, useState } from 'react';
import type { RunState } from '../../shared/contracts';
import { loadGodCheckpoint } from '../store/godRunCheckpoint';
import { useAppStore } from '../store/useAppStore';
import styles from './MainMenu.module.css';

export default function GodResumeButton() {
    const [checkpoint,setCheckpoint]=useState<RunState|null>(null);
    const [error,setError]=useState(false);
    useEffect(()=>{let cancelled=false; void loadGodCheckpoint().then(run=>{if(!cancelled)setCheckpoint(run);}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;};},[]);
    if(error) return <p role="status">Your endless checkpoint could not be read. It has been kept.</p>;
    if(!checkpoint?.godRun || checkpoint.godRun.phase==='failed') return null;
    return <button className={styles.noteAction} onClick={()=>useAppStore.setState({run:checkpoint,view:'playing'})}>Resume constellation · wave {checkpoint.godRun.wave}</button>;
}
