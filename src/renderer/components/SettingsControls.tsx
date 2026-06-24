import type { ReactNode } from 'react';
import { Panel, ScreenTitle } from '../ui';
import styles from './SettingsScreen.module.css';

interface ToggleRowProps {
    label: string;
    hint: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}

export const ToggleRow = ({ label, hint, checked, disabled = false, onChange }: ToggleRowProps) => (
    <label className={`${styles.toggleRow} ${disabled ? styles.toggleRowDisabled : ''}`.trim()}>
        <div className={styles.fieldText}>
            <strong>{label}</strong>
            <span>{hint}</span>
        </div>
        <span className={styles.toggleShell}>
            <input
                aria-disabled={disabled ? true : undefined}
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.currentTarget.checked)}
                type="checkbox"
            />
            <span className={styles.toggleTrack} />
        </span>
    </label>
);

interface SliderRowProps {
    label: string;
    hint: string;
    valueLabel: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (next: number) => void;
}

export const SliderRow = ({ label, hint, valueLabel, min, max, step, value, onChange }: SliderRowProps) => (
    <div className={styles.fieldCard}>
        <div className={styles.fieldText}>
            <strong>{label}</strong>
            <span>{hint}</span>
        </div>
        <div className={styles.sliderField}>
            <div className={styles.sliderValue}>{valueLabel}</div>
            <input
                aria-label={label}
                className={styles.rangeInput}
                max={String(max)}
                min={String(min)}
                onChange={(event) => onChange(Number(event.currentTarget.value))}
                step={String(step)}
                type="range"
                value={value}
            />
        </div>
    </div>
);

interface SegmentOption<T extends string> {
    label: string;
    value: T;
}

interface SegmentedControlProps<T extends string> {
    label: string;
    hint: string;
    value: T;
    options: ReadonlyArray<SegmentOption<T>>;
    onChange: (next: T) => void;
}

export const SegmentedControl = <T extends string,>({
    label,
    hint,
    value,
    options,
    onChange
}: SegmentedControlProps<T>) => (
    <div className={styles.fieldCard}>
        <div className={styles.fieldText}>
            <strong>{label}</strong>
            <span>{hint}</span>
        </div>
        <div className={styles.segmented}>
            {options.map((option) => (
                <button
                    aria-pressed={value === option.value}
                    className={`${styles.segmentButton} ${value === option.value ? styles.segmentButtonActive : ''}`.trim()}
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    type="button"
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);

interface PlaceholderControlProps {
    label: string;
    hint: string;
    options: string[];
    honestFuturePlaceholder?: boolean;
}

export const PlaceholderControl = ({
    label,
    hint,
    options,
    honestFuturePlaceholder = false
}: PlaceholderControlProps) => (
    <div className={`${styles.fieldCard} ${styles.placeholderField}`}>
        <div className={styles.fieldText}>
            {honestFuturePlaceholder ? (
                <div className={styles.placeholderLabelRow}>
                    <strong>{label}</strong>
                    <span className={styles.futurePill}>Coming soon</span>
                </div>
            ) : (
                <strong>{label}</strong>
            )}
            <span>{hint}</span>
            {honestFuturePlaceholder ? <span className={styles.demoScopeNote}>Not in Steam demo.</span> : null}
        </div>
        <div className={styles.segmented}>
            {options.map((option) => (
                <button
                    aria-disabled="true"
                    className={styles.segmentButtonDisabled}
                    disabled
                    key={option}
                    type="button"
                >
                    {option}
                </button>
            ))}
        </div>
    </div>
);

interface SettingsSectionProps {
    title: string;
    children: ReactNode;
}

export const SettingsSection = ({ title, children }: SettingsSectionProps) => (
    <Panel className={styles.section} padding="none" variant="muted">
        <ScreenTitle as="h3" className={styles.sectionHeading} role="section">
            {title}
        </ScreenTitle>
        {children}
    </Panel>
);
