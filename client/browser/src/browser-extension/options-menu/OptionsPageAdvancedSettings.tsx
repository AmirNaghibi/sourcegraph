import React, { useState } from 'react'

import styles from './OptionsPageAdvancedSettings.module.scss'

interface OptionsPageAdvancedSettingsProps {
    optionFlags: { key: string; label: string; value: boolean }[]
    onChangeOptionFlag: (key: string, value: boolean) => void
}

export const OptionsPageAdvancedSettings: React.FunctionComponent<OptionsPageAdvancedSettingsProps> = ({
    optionFlags,
    onChangeOptionFlag,
}) => (
    <section className="mt-3">
        <h6>
            <small>Configuration</small>
        </h6>
        <div>
            {optionFlags.map(({ label, key, value }) => (
                <div className="form-check" key={key}>
                    <label className="form-check-label">
                        <input
                            id={key}
                            onChange={event => onChangeOptionFlag(key, event.target.checked)}
                            className="form-check-input"
                            type="checkbox"
                            checked={value}
                        />{' '}
                        {label}
                    </label>
                </div>
            ))}
            <CodeTextArea />
        </div>
    </section>
)

const CodeTextArea: React.FunctionComponent = () => {
    const [value, setValue] = useState('') // TODO use stored value

    const onChange: React.ChangeEventHandler<HTMLTextAreaElement> = event => {
        setValue(event.target.value)
    }

    return (
        <div className={styles.blocklistEditor}>
            <ul className={styles.blocklistEditorGutter}>
                {value.split(/\n/).map((line, index) => (
                    <li key={index}>{index + 1}</li>
                ))}
            </ul>
            <textarea
                rows={4}
                className={styles.blocklistEditorTextarea}
                placeholder={`1
https://github.com/org/repo`}
                onChange={onChange}
            />
        </div>
    )
}
