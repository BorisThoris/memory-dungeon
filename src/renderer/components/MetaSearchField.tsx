import { forwardRef } from 'react';

interface MetaSearchFieldProps {
    ariaControls?: string;
    autoComplete?: string;
    id: string;
    inputClassName?: string;
    label: string;
    labelClassName?: string;
    onChange: (value: string) => void;
    placeholder: string;
    value: string;
}

const MetaSearchField = forwardRef<HTMLInputElement, MetaSearchFieldProps>(function MetaSearchField(
    {
        ariaControls,
        autoComplete = 'off',
        id,
        inputClassName,
        label,
        labelClassName,
        onChange,
        placeholder,
        value
    },
    ref
) {
    return (
        <>
            <label className={labelClassName} htmlFor={id}>
                {label}
            </label>
            <input
                ref={ref}
                aria-controls={ariaControls}
                autoComplete={autoComplete}
                className={inputClassName}
                id={id}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                type="search"
                value={value}
            />
        </>
    );
});

export default MetaSearchField;
