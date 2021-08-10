import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { RouteComponentProps } from 'react-router'

import { TelemetryProps } from '@sourcegraph/shared/src/telemetry/telemetryService'
import { Container, PageHeader } from '@sourcegraph/wildcard'

import {
    FilteredConnection,
    FilteredConnectionFilter,
    FilteredConnectionQueryArguments,
} from '../../../components/FilteredConnection'
import { PageTitle } from '../../../components/PageTitle'
import { LsifIndexFields, LSIFIndexState } from '../../../graphql-operations'

import { fetchLsifIndexes as defaultFetchLsifIndexes } from './backend'
import { CodeIntelIndexNode, CodeIntelIndexNodeProps } from './CodeIntelIndexNode'
import { enqueueIndexJob } from './backend'
import { ErrorAlert } from '@sourcegraph/web/src/components/alerts'

export interface CodeIntelIndexesPageProps extends RouteComponentProps<{}>, TelemetryProps {
    repo?: { id: string }
    fetchLsifIndexes?: typeof defaultFetchLsifIndexes
    now?: () => Date
}

const filters: FilteredConnectionFilter[] = [
    {
        id: 'filters',
        label: 'Index state',
        type: 'select',
        values: [
            {
                label: 'All',
                value: 'all',
                tooltip: 'Show all indexes',
                args: {},
            },
            {
                label: 'Completed',
                value: 'completed',
                tooltip: 'Show completed indexes only',
                args: { state: LSIFIndexState.COMPLETED },
            },
            {
                label: 'Errored',
                value: 'errored',
                tooltip: 'Show errored indexes only',
                args: { state: LSIFIndexState.ERRORED },
            },
            {
                label: 'Processing',
                value: 'processing',
                tooltip: 'Show processing indexes only',
                args: { state: LSIFIndexState.PROCESSING },
            },
            {
                label: 'Queued',
                value: 'queued',
                tooltip: 'Show queued indexes only',
                args: { state: LSIFIndexState.QUEUED },
            },
        ],
    },
]

export const CodeIntelIndexesPage: FunctionComponent<CodeIntelIndexesPageProps> = ({
    repo,
    fetchLsifIndexes = defaultFetchLsifIndexes,
    now,
    telemetryService,
    ...props
}) => {
    useEffect(() => telemetryService.logViewEvent('CodeIntelIndexes'), [telemetryService])

    const queryIndexes = useCallback(
        (args: FilteredConnectionQueryArguments) => fetchLsifIndexes({ repository: repo?.id, ...args }),
        [repo?.id, fetchLsifIndexes]
    )

    enum State {
        Idle,
        Queueing,
        Queued,
    }

    const [enqueueError, setEnqueueError] = useState<Error>()
    const [state, setState] = useState(() => State.Idle)
    const [revlike, setRevlike] = useState('HEAD')

    const onClick = useCallback(async () => {
        if (!repo) {
            return
        }

        setState(State.Queueing)
        setEnqueueError(undefined)

        try {
            await enqueueIndexJob(repo.id, revlike).toPromise()
        } catch (error) {
            setEnqueueError(error)
        } finally {
            setState(State.Queued)
        }
    }, [repo, revlike])

    return (
        <div className="code-intel-indexes">
            <PageTitle title="Auto-indexing jobs" />
            <PageHeader
                headingElement="h2"
                path={[{ text: 'Auto-indexing jobs' }]}
                description={
                    <>
                        Popular repositories are indexed automatically on{' '}
                        <a href="https://sourcegraph.com" target="_blank" rel="noreferrer noopener">
                            Sourcegraph.com
                        </a>
                        .
                    </>
                }
                className="mb-3"
            />

            <Container>
                {repo && (
                    <div>
                        {enqueueError && <ErrorAlert prefix="Error enqueueing index job" error={enqueueError} />}

                        <input type="text" value={revlike} onChange={event => setRevlike(event.target.value)} />

                        <button
                            type="button"
                            title="Enqueue thing"
                            disabled={state === State.Queueing}
                            className="btn btn-sm btn-secondary"
                            onClick={onClick}
                        >
                            Enqueue
                        </button>

                        {state === State.Queued && <div className="text-success">Index jobs enqueued</div>}
                    </div>
                )}

                <div className="list-group position-relative">
                    <FilteredConnection<LsifIndexFields, Omit<CodeIntelIndexNodeProps, 'node'>>
                        listComponent="div"
                        listClassName="codeintel-indexes__grid mb-3"
                        noun="index"
                        pluralNoun="indexes"
                        nodeComponent={CodeIntelIndexNode}
                        nodeComponentProps={{ now }}
                        queryConnection={queryIndexes}
                        history={props.history}
                        location={props.location}
                        cursorPaging={true}
                        filters={filters}
                    />
                </div>
            </Container>
        </div>
    )
}
