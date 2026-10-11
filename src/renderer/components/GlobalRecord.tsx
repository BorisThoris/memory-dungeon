import { useEffect, useState } from 'react';
import { fetchGlobalRecord, submitGlobalRecord, type GlobalRecord } from '../records/globalRecord';
import { reject } from '../records/playerNames.mjs';
import OverlayModal from './OverlayModal';
import styles from './GlobalRecord.module.css';
import { GLOBAL_RECORD_COPY as COPY } from '../copy/screenCopy';

export const GlobalRecordBadge = () => {
    const [record, setRecord] = useState<GlobalRecord | null | undefined>();
    const [offline, setOffline] = useState(false);
    useEffect(() => {
        let alive = true;
        void fetchGlobalRecord().then(({ record: row }) => { if (alive) setRecord(row); }, () => { if (alive) setOffline(true); });
        return () => { alive = false; };
    }, []);
    return <span className={styles.badge} aria-label={COPY.label}>{record
        ? COPY.holder(record.name, record.score.toLocaleString())
        : offline ? COPY.offline : record === null ? COPY.first : COPY.loading}</span>;
};

export const GlobalRecordResult = ({ score, resultKey, eligible = true }: { score: number; resultKey: string; eligible?: boolean }) => {
    const [open, setOpen] = useState(false);
    const [record, setRecord] = useState<GlobalRecord | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<'saved' | 'beaten' | null>(null);
    useEffect(() => {
        let alive = true;
        setOpen(false);setOutcome(null);setError('');setName('');
        if (eligible && Number.isSafeInteger(score) && score > 0) {
            void fetchGlobalRecord().then(({ record: row }) => {
                if (!alive) return;
                setRecord(row);
                if (score > (row?.score ?? 0)) setOpen(true);
            }, () => { /* An offline record check never blocks the results screen. */ });
        }
        return () => { alive = false; };
    }, [score, resultKey, eligible]);
    const dismiss = (): void => { setOpen(false); };
    const submit = async (): Promise<void> => {
        if (busy || outcome) return;
        const why = reject(name);
        if (why) { setError(why);return; }
        setBusy(true);setError('');
        try {
            const response = await submitGlobalRecord(name, score);
            setRecord(response.record);setOutcome(response.accepted ? 'saved' : 'beaten');
        } catch (cause) { setError(cause instanceof Error ? cause.message : COPY.failed); }
        finally { setBusy(false); }
    };
    if (!open) return null;
    return <OverlayModal title={outcome === 'saved' ? COPY.savedTitle : outcome === 'beaten' ? COPY.beatenTitle : COPY.title}
        subtitle={outcome === 'saved' ? COPY.savedSubtitle : outcome === 'beaten' ? COPY.beatenSubtitle : COPY.subtitle}
        onEscape={dismiss} testId="global-record-dialog" actions={outcome ? [{ label: COPY.continue, onClick: dismiss }] : [
            { label: busy ? COPY.saving : COPY.claim, onClick: () => { void submit(); }, variant: 'primary', disabled: busy },
            { label: COPY.skip, onClick: dismiss }
        ]}>
        <form className={styles.form} onSubmit={event => { event.preventDefault();void submit(); }}>
            <p className={styles.score}>{score.toLocaleString()}</p>
            {record && <p className={`${styles.notice} ${styles.previous}`}>{(outcome ? COPY.current : COPY.previous)(record.name, record.score.toLocaleString())}</p>}
            {!outcome && <><label className={styles.label} htmlFor="global-record-name">{COPY.name}</label>
                <input id="global-record-name" className={styles.input} autoComplete="nickname" maxLength={16} value={name}
                    aria-describedby="global-record-name-help" aria-invalid={Boolean(error)} disabled={busy}
                    onChange={event => { setName(event.target.value);setError(''); }} />
                <p id="global-record-name-help" className={`${styles.notice} ${styles.help}`}>{COPY.help}</p></>}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
    </OverlayModal>;
};
