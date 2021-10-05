import React from 'react'

import { CodeTextArea } from './CodeTextArea'
import { InfoText } from './InfoText'

const PLACEHOLDER = ['https://github.com/org/repo', 'https://github.com/org/*'].join('\n')

const Checkbox: React.FC<{ value: boolean; onChange: (value: boolean) => void }> = ({ value, children, onChange }) => (
    <div className="form-check">
        <label className="form-check-label">
            <input
                onChange={event => onChange(event.target.checked)}
                className="form-check-input"
                type="checkbox"
                checked={value}
            />{' '}
            {children}
        </label>
    </div>
)

interface OptionsPageAdvancedSettingsProps {
    optionFlags: { key: string; label: string; value: boolean }[]
    onChangeOptionFlag: (key: string, value: boolean) => void
    blocklist?: string | null
    onBlocklistChange: (value?: string | null) => void
}

export const OptionsPageAdvancedSettings: React.FunctionComponent<OptionsPageAdvancedSettingsProps> = ({
    optionFlags,
    onChangeOptionFlag,
    blocklist,
    onBlocklistChange,
}) => {
    const isBlocklistEnabled = typeof blocklist === 'string'
    return (
        <section className="mt-3 mb-2">
            {optionFlags.map(({ label, key, value }) => (
                <Checkbox key={key} value={value} onChange={value => onChangeOptionFlag(key, value)}>
                    {label}
                </Checkbox>
            ))}
            <Checkbox value={isBlocklistEnabled} onChange={value => onBlocklistChange(value ? '' : null)}>
                Sourcegraph cloud blocklist
            </Checkbox>
            {isBlocklistEnabled && (
                <>
                    <InfoText className="m-2">
                        We will not send any requests to Sourcegraph cloud servers for repository URL’s that are entered
                        here.
                    </InfoText>
                    <CodeTextArea
                        value={blocklist ?? ''}
                        onChange={onBlocklistChange}
                        rows={4}
                        placeholder={PLACEHOLDER}
                    />
                </>
            )}
        </section>
    )
}
