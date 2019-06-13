import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import DeleteIcon from 'mdi-react/DeleteIcon'
import React, { useCallback, useState } from 'react'
import { map, mapTo } from 'rxjs/operators'
import { NotificationType } from '../../../../../shared/src/api/client/services/notifications'
import { ExtensionsControllerNotificationProps } from '../../../../../shared/src/extensions/controller'
import { dataOrThrowErrors, gql } from '../../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../../shared/src/graphql/schema'
import { mutateGraphQL } from '../../../backend/graphql'

const deleteLabel = (args: GQL.IDeleteLabelOnMutationArguments): Promise<void> =>
    mutateGraphQL(
        gql`
            mutation DeleteLabel($label: ID!) {
                deleteLabel(label: $label) {
                    alwaysNil
                }
            }
        `,
        args
    )
        .pipe(
            map(dataOrThrowErrors),
            mapTo(void 0)
        )
        .toPromise()

interface Props extends ExtensionsControllerNotificationProps {
    label: Pick<GQL.ILabel, 'id'>
    onDelete: () => void
    className?: string
    buttonClassName?: string
}

/**
 * A button that permanently deletes a label.
 */
export const LabelDeleteButton: React.FunctionComponent<Props> = ({
    label,
    onDelete,
    className = '',
    buttonClassName = 'btn-link text-decoration-none',
    extensionsController,
}) => {
    const [isLoading, setIsLoading] = useState(false)
    const onClick = useCallback<React.FormEventHandler>(
        async e => {
            e.preventDefault()
            if (!confirm('Are you sure? Deleting will remove it from all threads.')) {
                return
            }
            setIsLoading(true)
            try {
                await deleteLabel({ label: label.id })
                setIsLoading(false)
                onDelete()
            } catch (err) {
                setIsLoading(false)
                extensionsController.services.notifications.showMessages.next({
                    message: `Error deleting label: ${err.message}`,
                    type: NotificationType.Error,
                })
            }
        },
        [extensionsController.services.notifications.showMessages, label.id, onDelete]
    )
    return (
        <button type="button" disabled={isLoading} className={`btn ${buttonClassName} ${className}`} onClick={onClick}>
            {isLoading ? <LoadingSpinner className="icon-inline" /> : <DeleteIcon className="icon-inline" />} Delete
        </button>
    )
}
