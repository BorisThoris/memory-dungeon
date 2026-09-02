import styles from './SectionRail.module.css';

/**
 * A section chooser that collapses instead of wrapping. Wide screens get a tab rail; narrow
 * ones get the same choice as a menu, so a thirteen-section rail costs one row on a phone
 * rather than five.
 */

export interface SectionRailOption {
    id: string;
    label: string;
    /** Optional right-hand count, e.g. "8" or "3/16". */
    badge?: string;
}

export interface SectionRailProps {
    label: string;
    options: readonly SectionRailOption[];
    activeId: string;
    onSelect: (id: string) => void;
    /** Element the rail controls, for `aria-controls`. */
    controls?: string;
    /** Prefix for each tab's id and test id, e.g. "codex-tab". */
    idPrefix: string;
}

const SectionRail = ({ activeId, controls, idPrefix, label, onSelect, options }: SectionRailProps) => (
    <div className={styles.root}>
        <div aria-label={label} className={styles.tabs} role="tablist">
            {options.map((option) => (
                <button
                    aria-controls={controls}
                    aria-selected={option.id === activeId}
                    className={styles.tab}
                    data-testid={`${idPrefix}-${option.id}`}
                    id={`${idPrefix}-${option.id}`}
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    role="tab"
                    tabIndex={option.id === activeId ? 0 : -1}
                    type="button"
                >
                    {option.label}
                    {option.badge ? <span className={styles.badge}>{option.badge}</span> : null}
                </button>
            ))}
        </div>
        <label className={styles.menu}>
            <span className={styles.srOnly}>{label}</span>
            <select
                aria-controls={controls}
                className={styles.select}
                data-testid={`${idPrefix}-menu`}
                onChange={(event) => onSelect(event.target.value)}
                value={activeId}
            >
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.badge ? `${option.label} · ${option.badge}` : option.label}
                    </option>
                ))}
            </select>
        </label>
    </div>
);

export default SectionRail;
