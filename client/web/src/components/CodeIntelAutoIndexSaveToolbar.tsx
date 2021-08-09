import DollyIcon from 'mdi-react/DollyIcon'
import * as React from 'react'

import { SaveToolbar, SaveToolbarProps } from './SaveToolbar'

export interface AutoIndexProps {
    onInfer?: () => void
}

export const CodeIntelAutoIndexSaveToolbar: React.FunctionComponent<SaveToolbarProps & AutoIndexProps> = ({
    dirty,
    saving,
    error,
    onSave,
    onDiscard,
    onInfer,
    saveDiscardDisabled,
}) => (
    <SaveToolbar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        error={error}
        saveDiscardDisabled={saveDiscardDisabled}
        onDiscard={onDiscard}
    >
        <button
            type="button"
            title="Infer index configuration from HEAD"
            className="btn btn-sm btn-secondary save-toolbar__item save-toolbar__btn save-toolbar__btn-last test-save-toolbar-discard"
            onClick={onInfer}
        >
            <DollyIcon className="icon-inline" style={{ marginRight: '0.15em' }} /> Infer configuration
        </button>
    </SaveToolbar>
)
