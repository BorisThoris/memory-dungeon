import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_CLASSIC_RUN_SETUP, isDefaultClassicRunSetup, type ClassicRunSetup } from '../../shared/classic-run-setup';
import { parseRunShareKey } from '../../shared/run-share-key';
import { useAppStore } from '../store/useAppStore';
import { UiButton } from '../ui';
import OverlayModal from './OverlayModal';
import styles from './ChooseYourPathScreen.module.css';

/** Optional setup only. The main menu's Play action starts a normal run directly. */
const ChooseYourPathScreen = () => {
    const { closeSubscreen, startRun, startSharedRun, startPassAndPlayRun } = useAppStore(useShallow(state => ({
        closeSubscreen: state.closeSubscreen, startRun: state.startRun,
        startSharedRun: state.startSharedRun, startPassAndPlayRun: state.startPassAndPlayRun
    })));
    const [setup, setSetup] = useState<ClassicRunSetup>(DEFAULT_CLASSIC_RUN_SETUP);
    const [key, setKey] = useState('');
    const [error, setError] = useState(false);
    const playSolo = () => isDefaultClassicRunSetup(setup) ? startRun() : startRun(setup);
    return <OverlayModal title="Play options" subtitle="Solo, together, or the same run as a friend."
        testId="play-options" onEscape={closeSubscreen} wide
        actions={[{label:'Back',onClick:closeSubscreen,variant:'secondary'},
            {label:'Play now',onClick:playSolo,variant:'primary'}]}>
        <div className={styles.options}>
            <details className={styles.section}>
                <summary>Customize a solo run</summary>
                <div className={styles.content} data-testid="classic-setup-sheet">
                    <p>These settings apply to the next run.</p>
                    <label className={styles.check}><input type="checkbox" checked={setup.pacing === 'calm'}
                        onChange={e=>setSetup({...setup,pacing:e.target.checked?'calm':'standard'})}/><span>More time to study the cards</span></label>
                    <label className={styles.check}><input type="checkbox" checked={setup.chaos}
                        onChange={e=>setSetup({...setup,chaos:e.target.checked})}/><span>Chaos: jokers and extra board twists</span></label>
                    <label className={styles.check}><input type="checkbox" checked={setup.unrecorded}
                        onChange={e=>setSetup({...setup,unrecorded:e.target.checked})}/><span>Practice without changing my records</span></label>
                    <fieldset className={styles.vows}><legend>Extra challenges</legend>
                        {([['scholar','No shuffles'],['pin_vow','At most 10 pins per run']] as const).map(([id,label])=>
                            <label className={styles.check} key={id}><input type="checkbox" checked={setup.vows.includes(id)}
                                onChange={e=>setSetup({...setup,vows:e.target.checked?[...setup.vows,id]:setup.vows.filter(v=>v!==id)})}/><span>{label}</span></label>)}
                    </fieldset>
                    <UiButton onClick={playSolo} variant="primary">Start custom run</UiButton>
                </div>
            </details>
            <details className={styles.section}>
                <summary>Play together on this device</summary>
                <div className={styles.content}>
                    <p>Take turns for 3 floors. Find a pair to play again; miss and pass the device.</p>
                    <div className={styles.seats}>{([2,3,4] as const).map(seats=>
                        <UiButton key={seats} onClick={()=>startPassAndPlayRun(seats)}>{seats} players</UiButton>)}</div>
                </div>
            </details>
            <details className={styles.section}>
                <summary>Use a shared run key</summary>
                <form className={styles.content} data-testid="choose-path-shared-run" onSubmit={e=>{
                    e.preventDefault();
                    if(!parseRunShareKey(key)){setError(true);return;}
                    setError(false);startSharedRun(key);
                }}>
                    <label className={styles.keyLabel} htmlFor="shared-run-key">Paste a run key or a friend's share message</label>
                    <input id="shared-run-key" className={styles.keyInput} type="text" autoComplete="off" value={key}
                        aria-invalid={error} aria-describedby={error?'shared-run-error':undefined}
                        onChange={e=>{setKey(e.target.value);setError(false);}} placeholder="md1:classic:…"/>
                    {error&&<p id="shared-run-error" data-testid="choose-path-shared-run-error" role="alert">That message doesn't contain a valid run key. Copy the full key and try again.</p>}
                    <UiButton type="submit" variant="primary" disabled={!key.trim()}>Play shared run</UiButton>
                </form>
            </details>
        </div>
    </OverlayModal>;
};
export default ChooseYourPathScreen;
