import React from 'react'

import styles from './CodeTextArea.module.scss'

interface CodeTextAreaProps {
    placeholder?: string
    rows?: number
    onChange: (value: string) => void
    value: string
}

export const CodeTextArea: React.FC<CodeTextAreaProps> = ({ value, placeholder, rows = 2, onChange }) => {
    const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = event => {
        onChange(event.target.value)
    }

    const lineNumbers = new Array(Math.max(value.split(/\n/).length, rows)).fill(0)

    return (
        // eslint-disable-next-line react/forbid-dom-props
        <div className={styles.blocklistEditor} style={{ maxHeight: `${rows * 1.6}rem` }}>
            <ul className={styles.blocklistEditorGutter}>
                {lineNumbers.map((line, index) => (
                    <li key={index}>{index + 1}</li>
                ))}
            </ul>
            <textarea
                rows={rows}
                value={value}
                className={styles.blocklistEditorTextarea}
                placeholder={placeholder}
                onChange={handleChange}
            />
        </div>
    )
}
