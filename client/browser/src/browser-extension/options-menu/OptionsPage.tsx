import classNames from 'classnames'
import BookOpenPageVariantIcon from 'mdi-react/BookOpenPageVariantIcon'
import CheckCircleOutlineIcon from 'mdi-react/CheckCircleOutlineIcon'
import EarthIcon from 'mdi-react/EarthIcon'
import LockIcon from 'mdi-react/LockIcon'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToggle } from 'react-use'
import { Observable } from 'rxjs'

import { LoaderInput } from '@sourcegraph/branded/src/components/LoaderInput'
import { SourcegraphLogo } from '@sourcegraph/branded/src/components/SourcegraphLogo'
import { Toggle } from '@sourcegraph/branded/src/components/Toggle'
import { useInputValidation, deriveInputClassName } from '@sourcegraph/shared/src/util/useInputValidation'

import { DEFAULT_SOURCEGRAPH_URL } from '../../shared/util/context'
import { knownCodeHosts } from '../knownCodeHosts'

import { OptionsPageAdvancedSettings } from './OptionsPageAdvancedSettings'

export interface OptionsPageProps {
    version: string

    // Sourcegraph URL
    sourcegraphUrl: string
    validateSourcegraphUrl: (url: string) => Observable<string | undefined>
    onChangeSourcegraphUrl: (url: string, enabled: boolean) => void

    // Option flags
    optionFlags: { key: string; label: string; value: boolean }[]
    onChangeOptionFlag: (key: string, value: boolean) => void

    isActivated: boolean
    onToggleActivated: (value: boolean) => void

    isFullPage: boolean
    showPrivateRepositoryAlert?: boolean
    showSourcegraphCloudAlert?: boolean
    permissionAlert?: { name: string; icon?: React.ComponentType<{ className?: string }> }
    requestPermissionsHandler?: React.MouseEventHandler
    currentHost?: string
}

// "Error code" constants for Sourcegraph URL validation
export const URL_FETCH_ERROR = 'URL_FETCH_ERROR'
export const URL_AUTH_ERROR = 'URL_AUTH_ERROR'
const LINK_PROPS: Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'rel' | 'target'> = {
    target: '_blank',
    rel: 'noopener noreferrer',
}

export const OptionsPage: React.FunctionComponent<OptionsPageProps> = ({
    version,
    sourcegraphUrl,
    validateSourcegraphUrl,
    isActivated,
    onToggleActivated,
    isFullPage,
    showPrivateRepositoryAlert,
    showSourcegraphCloudAlert,
    permissionAlert,
    requestPermissionsHandler,
    optionFlags,
    onChangeOptionFlag,
    onChangeSourcegraphUrl,
    currentHost,
}) => {
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

    const toggleAdvancedSettings = useCallback(
        () => setShowAdvancedSettings(showAdvancedSettings => !showAdvancedSettings),
        []
    )

    return (
        <div className={classNames('options-page', isFullPage && 'options-page--full shadow')}>
            <section className="options-page__section">
                <div className="d-flex justify-content-between">
                    <SourcegraphLogo className="options-page__logo" />
                    <div>
                        <Toggle
                            value={isActivated}
                            onToggle={onToggleActivated}
                            title={`Toggle to ${isActivated ? 'disable' : 'enable'} extension`}
                            aria-label="Toggle browser extension"
                        />
                    </div>
                </div>
                <div className="options-page__version">v{version}</div>
            </section>
            <CodeHostsSection currentHost={currentHost} />
            <section className="options-page__section border-0">
                {/* eslint-disable-next-line react/forbid-elements */}
                <form onSubmit={preventDefault} noValidate={true}>
                    {/* TODO: implement onChange/onDisable of multiple URLs */}
                    <SourcegraphURLInput
                        label="Sourcegraph Cloud"
                        description={
                            <>
                                Enable to get code intel for millions of public repositories and your synced private
                                repositories on <a href={DEFAULT_SOURCEGRAPH_URL}>sourcegraph.com</a>
                            </>
                        }
                        editable={false}
                        initialValue={sourcegraphUrl}
                        onChange={onChangeSourcegraphUrl}
                        validate={validateSourcegraphUrl}
                    />
                    <SourcegraphURLInput
                        label="Self hosted Sourcegraph instance"
                        description="Enter the URL of your Sourcegraph instance to use the extension on private code."
                        initialValue={sourcegraphUrl}
                        onChange={onChangeSourcegraphUrl}
                        validate={validateSourcegraphUrl}
                    />
                </form>

                <a href="https://docs.sourcegraph.com/integration/browser_extension#privacy" {...LINK_PROPS}>
                    <small>How do we keep your code private?</small>
                </a>
            </section>

            {permissionAlert && (
                <PermissionAlert {...permissionAlert} onClickGrantPermissions={requestPermissionsHandler} />
            )}

            {showSourcegraphCloudAlert && <SourcegraphCloudAlert />}

            {showPrivateRepositoryAlert && <PrivateRepositoryAlert />}
            <section className="options-page__section">
                <p className="mb-0">
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={toggleAdvancedSettings}>
                        <small>{showAdvancedSettings ? 'Hide' : 'Show'} advanced settings</small>
                    </button>
                </p>
                {showAdvancedSettings && (
                    <OptionsPageAdvancedSettings optionFlags={optionFlags} onChangeOptionFlag={onChangeOptionFlag} />
                )}
            </section>
            <section className="d-flex">
                <div className="options-page__split-section-part">
                    <a href="https://sourcegraph.com/search" {...LINK_PROPS}>
                        <EarthIcon className="icon-inline mr-2" />
                        Sourcegraph Cloud
                    </a>
                </div>
                <div className="options-page__split-section-part">
                    <a href="https://docs.sourcegraph.com" {...LINK_PROPS}>
                        <BookOpenPageVariantIcon className="icon-inline mr-2" />
                        Documentation
                    </a>
                </div>
            </section>
        </div>
    )
}

interface PermissionAlertProps {
    icon?: React.ComponentType<{ className?: string }>
    name: string
    onClickGrantPermissions?: React.MouseEventHandler
}

const PermissionAlert: React.FunctionComponent<PermissionAlertProps> = ({
    name,
    icon: Icon,
    onClickGrantPermissions,
}) => (
    <section className="options-page__section bg-2">
        <h4>
            {Icon && <Icon className="icon-inline mr-2" />} <span>{name}</span>
        </h4>
        <p className="options-page__permission-text">
            <strong>Grant permissions</strong> to use the Sourcegraph extension on {name}.
        </p>
        <button type="button" onClick={onClickGrantPermissions} className="btn btn-sm btn-primary">
            <small>Grant permissions</small>
        </button>
    </section>
)

const PrivateRepositoryAlert: React.FunctionComponent = () => (
    <section className="options-page__section bg-2">
        <h4>
            <LockIcon className="icon-inline mr-2" />
            Private repository
        </h4>
        <p>
            To use the browser extension with your private repositories, you need to set up a{' '}
            <strong>private Sourcegraph instance</strong> and connect the browser extension to it.
        </p>
        <ol>
            <li className="mb-2">
                <a href="https://docs.sourcegraph.com/" rel="noopener" target="_blank">
                    Install and configure Sourcegraph
                </a>
                . Skip this step if you already have a private Sourcegraph instance.
            </li>
            <li className="mb-2">Click the Sourcegraph icon in the browser toolbar to bring up this popup again.</li>
            <li className="mb-2">
                Enter the URL (including the protocol) of your Sourcegraph instance above, e.g.{' '}
                <q>https://sourcegraph.example.com</q>.
            </li>
            <li>
                Make sure that the status says <q>Looks good!</q>.
            </li>
        </ol>
    </section>
)

const CodeHostsSection: React.FunctionComponent<{ currentHost?: string }> = ({ currentHost }) => (
    <section className="options-page__section">
        <p>Get code intelligence tooltips while browsing files and reading PRs on your code host.</p>
        <div>
            {knownCodeHosts.map(({ host, icon: Icon }) => (
                <span
                    key={host}
                    className={classNames('code-hosts-section__icon', {
                        // Use `endsWith` in order to match subdomains.
                        'bg-3': currentHost?.endsWith(host),
                    })}
                >
                    {Icon && <Icon />}
                </span>
            ))}
        </div>
    </section>
)

const SourcegraphCloudAlert: React.FC = () => (
    <section className="options-page__section bg-2">
        <h4>
            <CheckCircleOutlineIcon className="icon-inline mr-2" />
            You're on Sourcegraph Cloud
        </h4>
        <p>Naturally, the browser extension is not necessary to browse public code on sourcegraph.com.</p>
    </section>
)

function preventDefault(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
}

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" className={className} height="16" viewBox="0 0 16 16">
        <path
            fill="#37b24d"
            d="M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z"
        />
    </svg>
)

interface SourcegraphURLInputProps extends Omit<URLInputProps, 'onChange'> {
    label: string
    description: JSX.Element | string
    onChange: OptionsPageProps['onChangeSourcegraphUrl']
    editable?: boolean
}
const SourcegraphURLInput: React.FC<SourcegraphURLInputProps> = ({
    label,
    description,
    editable = true,
    initialValue,
    onChange,
    validate,
}) => {
    const [enabled, onToggleEnabled] = useToggle(true)
    const [value, setValue] = useState<string | null>(null)

    useEffect(() => {
        if (!value) {
            return
        }
        onChange(value, enabled)
    }, [onChange, value, enabled])

    return (
        <div className="mb-3 position-relative">
            <Toggle value={enabled} onToggle={onToggleEnabled} title={label} className="mr-2" />
            <label htmlFor="sourcegraph-url">{label}</label>
            {enabled && editable && (
                <URLInput
                    initialValue={initialValue}
                    onChange={url => {
                        console.log('onChange', url)
                        setValue(url)
                    }}
                    validate={validate}
                />
            )}
            {!editable && enabled && <CheckIcon className="options-page__check-icon position-absolute" />}
            {(!enabled || !editable) && (
                <p>
                    <small>{description}</small>
                </p>
            )}
        </div>
    )
}

interface URLInputProps {
    onChange: (value: string) => void
    initialValue: string
    validate: OptionsPageProps['validateSourcegraphUrl']
}

const URLInput: React.FC<URLInputProps> = ({ onChange, initialValue, validate }) => {
    const urlInputReference = useRef<HTMLInputElement | null>(null)
    const [urlState, nextUrlFieldChange, nextUrlInputElement] = useInputValidation(
        useMemo(
            () => ({
                initialValue,
                synchronousValidators: [],
                asynchronousValidators: [validate],
            }),
            [initialValue, validate]
        )
    )

    const urlInputElements = useCallback(
        (urlInputElement: HTMLInputElement | null) => {
            urlInputReference.current = urlInputElement
            nextUrlInputElement(urlInputElement)
        },
        [nextUrlInputElement]
    )

    useEffect(() => {
        if (urlState.kind === 'VALID') {
            onChange(urlState.value)
        }
    }, [onChange, urlState])

    return (
        <>
            <LoaderInput loading={urlState.kind === 'LOADING'} className={classNames(deriveInputClassName(urlState))}>
                <input
                    className={classNames(
                        'form-control',
                        'mb-2',
                        deriveInputClassName(urlState),
                        'test-sourcegraph-url'
                    )}
                    id="sourcegraph-url"
                    type="url"
                    pattern="^https://.*"
                    value={urlState.value}
                    onChange={nextUrlFieldChange}
                    ref={urlInputElements}
                    spellCheck={false}
                    required={true}
                />
            </LoaderInput>
            {urlState.kind === 'LOADING' && <small className="text-muted d-block mt-1">Checking...</small>}
            {urlState.kind === 'INVALID' && (
                <small className="invalid-feedback">
                    {urlState.reason === URL_FETCH_ERROR && 'Incorrect Sourcegraph instance address'}
                    {urlState.reason === URL_AUTH_ERROR ? (
                        <>
                            Authentication to Sourcegraph failed.{' '}
                            <a href={urlState.value} {...LINK_PROPS}>
                                Sign in to your instance
                            </a>{' '}
                            to continue
                        </>
                    ) : urlInputReference.current?.validity.typeMismatch ? (
                        'Please enter a valid URL, including the protocol prefix (e.g. https://sourcegraph.example.com).'
                    ) : urlInputReference.current?.validity.patternMismatch ? (
                        'The browser extension can only work over HTTPS in modern browsers.'
                    ) : (
                        urlState.reason
                    )}
                </small>
            )}
            {urlState.kind === 'VALID' && (
                <small className="valid-feedback test-valid-sourcegraph-url-feedback">Looks good!</small>
            )}
        </>
    )
}
