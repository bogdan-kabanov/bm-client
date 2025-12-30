import React, { memo } from 'react';

interface EditableFieldProps {
    fieldKey: string;
    label: string;
    value: string;
    isFieldEditing: boolean;
    isSaving: boolean;
    error?: string;
    options?: {
        type?: string;
        placeholder?: string;
        inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
        className?: string;
    };
    onFieldChange: (fieldKey: string, value: string) => void;
    onFieldSubmit: (fieldKey: string, value?: string) => void;
    onCancelEditing: (fieldKey: string) => void;
    onStartEditing: (fieldKey: string) => void;
    getDisplayValue: (fieldKey: string) => string;
}

export const EditableField = memo<EditableFieldProps>(({
    fieldKey,
    label,
    value,
    isFieldEditing,
    isSaving,
    error,
    options,
    onFieldChange,
    onFieldSubmit,
    onCancelEditing,
    onStartEditing,
    getDisplayValue
}) => {
    return (
        <div className={`profile-field editable ${isFieldEditing ? 'editing' : ''} ${options?.className || ''}`}>
            {label && <span className="profile-field-label">{label}</span>}
            <div className="profile-field-value">
            {isFieldEditing ? (
                <div className="editable-input">
                    <input
                        type={options?.type || 'text'}
                        inputMode={options?.inputMode}
                        value={value}
                        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
                        placeholder={options?.placeholder}
                        autoFocus
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onFieldSubmit(fieldKey);
                            }
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                onCancelEditing(fieldKey);
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="confirm-btn"
                        onClick={() => onFieldSubmit(fieldKey)}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <span className="inline-loader" />
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className="cancel-inline-btn"
                        onClick={() => onCancelEditing(fieldKey)}
                        disabled={isSaving}
                    >
                        ×
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="editable-display"
                    onClick={() => onStartEditing(fieldKey)}
                >
                    <span>{getDisplayValue(fieldKey)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16.5 3.5C16.8978 3.10218 17.4374 2.87868 18 2.87868C18.5626 2.87868 19.1022 3.10218 19.5 3.5C19.8978 3.89782 20.1213 4.43739 20.1213 5C20.1213 5.56261 19.8978 6.10218 19.5 6.5L8 18L4 19L5 15L16.5 3.5Z"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}
            </div>
            {error && <span className="error-text">{error}</span>}
        </div>
    );
});

EditableField.displayName = 'EditableField';

