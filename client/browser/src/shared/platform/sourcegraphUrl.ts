import { Observable, of, from, merge, BehaviorSubject } from 'rxjs'
import { map, first, defaultIfEmpty, distinctUntilChanged, startWith, tap, filter } from 'rxjs/operators'

import { dataOrThrowErrors, gql } from '@sourcegraph/shared/src/graphql/graphql'
import * as GQL from '@sourcegraph/shared/src/graphql/schema'
import { isDefined } from '@sourcegraph/shared/src/util/types'

import { background } from '../../browser-extension/web-extension-api/runtime'
import { observeStorageKey, storage } from '../../browser-extension/web-extension-api/storage'
import { SyncStorageItems } from '../../browser-extension/web-extension-api/types'

export const DEFAULT_SOURCEGRAPH_URL = 'https://sourcegraph.com'
const QUERY = gql`
    query ResolveRawRepoName($repoName: String!) {
        repository(name: $repoName) {
            mirrorInfo {
                cloned
            }
        }
    }
`

// TODO: show notification if not signed in
const checkRepoCloned = (sourcegraphURL: string, repoName: string): Observable<boolean> =>
    from(
        background.requestGraphQL<GQL.IQuery>({
            request: QUERY,
            variables: { repoName },
            sourcegraphURL,
        })
    ).pipe(
        map(dataOrThrowErrors),
        map(({ repository }) => !!repository?.mirrorInfo?.cloned)
    )

export const SourcegraphURL = (() => {
    const DEFAULT_URLS = [{ url: DEFAULT_SOURCEGRAPH_URL }]
    // todo change name
    const observeSgURLs = observeStorageKey('sync', 'sgURLs')

    const LastURLSubject = new BehaviorSubject<string | undefined>(undefined)
    const SgURLs = new BehaviorSubject<SyncStorageItems['sgURLs']>([])

    // eslint-disable-next-line rxjs/no-ignored-subscription
    observeSgURLs.pipe(map(URLs => URLs ?? DEFAULT_URLS)).subscribe(SgURLs)

    observeSgURLs
        .pipe(
            filter(isDefined),
            map(URLs => (URLs.length > 0 ? URLs[0].url : DEFAULT_SOURCEGRAPH_URL)),
            distinctUntilChanged()
        )
        // eslint-disable-next-line rxjs/no-ignored-subscription
        .subscribe(LastURLSubject)

    const isValid = (url: string): boolean => !!SgURLs?.value.find(item => item.url === url && !item.disabled)

    const determineSgURL = async (rawRepoName: string): Promise<string | undefined> => {
        const { repoToSgURL = {} } = await storage.sync.get('repoToSgURL')

        const cachedURLForRepoName = repoToSgURL[rawRepoName]
        if (cachedURLForRepoName && isValid(cachedURLForRepoName)) {
            return cachedURLForRepoName
        }

        const URLs = SgURLs?.value.filter(({ disabled }) => !disabled).map(({ url }) => url)

        return merge(
            ...URLs.map(sgURL => checkRepoCloned(sgURL, rawRepoName).pipe(map(isCloned => ({ isCloned, sgURL }))))
        )
            .pipe(
                first(item => item.isCloned),
                map(({ sgURL }) => sgURL),
                defaultIfEmpty<string | undefined>(undefined),
                tap(sgURL => {
                    if (sgURL) {
                        repoToSgURL[rawRepoName] = sgURL
                        storage.sync.set({ repoToSgURL }).catch(console.error)
                    }
                })
            )
            .toPromise()
    }

    return {
        observe: function observe(isExtension: boolean = true): Observable<string> {
            if (!isExtension) {
                return of(
                    window.SOURCEGRAPH_URL || window.localStorage.getItem('SOURCEGRAPH_URL') || DEFAULT_SOURCEGRAPH_URL
                )
            }

            console.log('SourcegraphURL.observe:', isExtension)
            return LastURLSubject.asObservable().pipe(
                filter(isDefined),
                tap(sourcegraphURL => console.log({ sourcegraphURL }))
            )
        },
        use: async function use(rawRepoName: string): Promise<void> {
            // TODO: check if URL was disabled, then invalidate cache or don't use it at all
            const sgURL = await determineSgURL(rawRepoName)
            console.log('SourcegraphURL.use:', rawRepoName)
            if (!sgURL) {
                console.warn(`Couldn't detect sourcegraphURL for the ${rawRepoName}`)
                return
            }

            if (sgURL === LastURLSubject.value) {
                return
            }

            LastURLSubject.next(sgURL)
        },
        update: function update(sgURLs: SyncStorageItems['sgURLs']): Promise<void> {
            console.log('SourcegraphURL.update:', sgURLs)
            return storage.sync.set({ sgURLs })
        },
    }
})()
