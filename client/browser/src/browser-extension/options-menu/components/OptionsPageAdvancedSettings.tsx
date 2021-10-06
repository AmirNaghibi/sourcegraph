import React, { useCallback, useContext, useState } from 'react'

import { OptionsPageContext } from '../OptionsPage.context'

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

export const OptionsPageAdvancedSettings: React.FC = () => {
    const { optionFlags, onChangeOptionFlag, blocklist, onBlocklistChange } = useContext(OptionsPageContext)
    const [isBlocklistEnabled, setIsBlocklistEnabled] = useState(!!blocklist?.enabled)
    const handleTextAreaChange = useCallback(
        (content: string) => {
            onBlocklistChange(isBlocklistEnabled, content)
        },
        [isBlocklistEnabled, onBlocklistChange]
    )
    return (
        <section className="mt-3 mb-2">
            {optionFlags.map(({ label, key, value }) => (
                <Checkbox key={key} value={value} onChange={value => onChangeOptionFlag(key, value)}>
                    {label}
                </Checkbox>
            ))}
            <Checkbox value={isBlocklistEnabled} onChange={setIsBlocklistEnabled}>
                Sourcegraph cloud blocklist
            </Checkbox>
            {isBlocklistEnabled && (
                <>
                    <InfoText className="m-2">
                        We will not send any requests to Sourcegraph cloud servers for repository URL’s that are entered
                        here.
                    </InfoText>
                    <CodeTextArea
                        rows={4}
                        placeholder={PLACEHOLDER}
                        value={blocklist?.content ?? ''}
                        onChange={handleTextAreaChange}
                    />
                </>
            )}
        </section>
    )
}
