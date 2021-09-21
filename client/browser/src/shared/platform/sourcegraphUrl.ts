import { Observable, of, from, merge, BehaviorSubject } from 'rxjs'
import { map, first, defaultIfEmpty, distinctUntilChanged, startWith, tap } from 'rxjs/operators'

import { dataOrThrowErrors, gql } from '@sourcegraph/shared/src/graphql/graphql'
import * as GQL from '@sourcegraph/shared/src/graphql/schema'

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
    const observeSgURLs = (): Observable<SyncStorageItems['sgURLs']> =>
        observeStorageKey('sync', 'sgURLs').pipe(map(URLs => URLs || []))

    const URLSubject = new BehaviorSubject<string>(DEFAULT_SOURCEGRAPH_URL)

    observeSgURLs()
        .pipe(
            map(URLs => (URLs.length > 0 ? URLs[0].url : DEFAULT_SOURCEGRAPH_URL)),
            startWith(DEFAULT_SOURCEGRAPH_URL),
            distinctUntilChanged()
        )
        // eslint-disable-next-line rxjs/no-ignored-subscription
        .subscribe(URLSubject)

    const determineSgURL = async (rawRepoName: string): Promise<string | undefined> => {
        const sgURLs = (await storage.sync.get('sgURLs'))?.sgURLs || [{ url: DEFAULT_SOURCEGRAPH_URL }]
        const URLs = sgURLs.filter(({ disabled }) => !disabled).map(({ url }) => url)

        return merge(
            ...URLs.map(sgURL => checkRepoCloned(sgURL, rawRepoName).pipe(map(isCloned => ({ isCloned, sgURL }))))
        )
            .pipe(
                first(item => item.isCloned),
                map(({ sgURL }) => sgURL),
                defaultIfEmpty<string | undefined>(undefined)
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
            return URLSubject.asObservable().pipe(tap(sourcegraphURL => console.log({ sourcegraphURL })))
        },
        use: async function use(rawRepoName: string): Promise<void> {
            // TODO: check if URL was disabled, then invalidate cache or don't use it at all
            const { repoToSgURL = {} } = await storage.sync.get('repoToSgURL')
            console.log('SourcegraphURL.use:', repoToSgURL)

            let sgURL = repoToSgURL[rawRepoName]
            if (sgURL) {
                if (sgURL === URLSubject.value) {
                    return
                }
                return URLSubject.next(sgURL)
            }

            sgURL = await determineSgURL(rawRepoName)
            if (sgURL) {
                URLSubject.next(sgURL)
                repoToSgURL[rawRepoName] = sgURL
                storage.sync.set({ repoToSgURL }).catch(console.error)
            }
        },
        update: function update(sgURLs: SyncStorageItems['sgURLs']): Promise<void> {
            console.log('SourcegraphURL.update:', sgURLs)
            return storage.sync.set({ sgURLs })
        },
    }
})()
