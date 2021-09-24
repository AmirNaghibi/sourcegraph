import { Observable, of, from, merge, BehaviorSubject } from 'rxjs'
import { map, first, defaultIfEmpty, distinctUntilChanged, tap } from 'rxjs/operators'

import { dataOrThrowErrors, gql } from '@sourcegraph/shared/src/graphql/graphql'
import * as GQL from '@sourcegraph/shared/src/graphql/schema'

import { background } from '../../browser-extension/web-extension-api/runtime'
import { observeStorageKey, storage } from '../../browser-extension/web-extension-api/storage'
import { SyncStorageItems, SgURL } from '../../browser-extension/web-extension-api/types'

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

const DEFAULT_URLS = [{ url: DEFAULT_SOURCEGRAPH_URL }, { url: '', disabled: true }] // TODO: add second url placeholder
const isEnabled = ({ disabled }: SgURL): boolean => !disabled

export const SourcegraphURL = (() => {
    const sgURLs = observeStorageKey('sync', 'sgURLs')

    const LastURLSubject = new BehaviorSubject<string | undefined>(undefined)
    const SgURLsSubject = new BehaviorSubject<SyncStorageItems['sgURLs']>([])

    // eslint-disable-next-line rxjs/no-ignored-subscription
    sgURLs.pipe(map(URLs => (URLs?.length ? URLs : DEFAULT_URLS))).subscribe(SgURLsSubject)

    sgURLs
        .pipe(
            tap(URLs => console.log(URLs)),
            map(URLs => URLs?.find(isEnabled)?.url)
        )
        // eslint-disable-next-line rxjs/no-ignored-subscription
        .subscribe(LastURLSubject)

    const isValid = (url: string): boolean => !!SgURLsSubject?.value.find(item => item.url === url && !item.disabled)

    const determineSgURL = async (rawRepoName: string): Promise<string | undefined> => {
        const { repoToSgURL = {} } = await storage.sync.get('repoToSgURL')

        const cachedURLForRepoName = repoToSgURL[rawRepoName]
        if (cachedURLForRepoName && isValid(cachedURLForRepoName)) {
            return cachedURLForRepoName
        }

        const URLs = SgURLsSubject?.value.filter(isEnabled).map(({ url }) => url)
        if (!URLs?.length) {
            return Promise.resolve(undefined)
        }

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
        URLs: SgURLsSubject.asObservable(),
        observe: (isExtension: boolean = true): Observable<string> => {
            if (!isExtension) {
                return of(
                    window.SOURCEGRAPH_URL || window.localStorage.getItem('SOURCEGRAPH_URL') || DEFAULT_SOURCEGRAPH_URL
                )
            }

            return LastURLSubject.asObservable().pipe(
                distinctUntilChanged(),
                tap(currentURL => console.log('currentURL=', currentURL))
            )
        },
        use: async (rawRepoName: string): Promise<void> => {
            const sgURL = await determineSgURL(rawRepoName)
            if (!sgURL) {
                console.error(`Couldn't detect sourcegraphURL for the ${rawRepoName}`)
                return
            }

            LastURLSubject.next(sgURL)
        },
        update: (sgURLs: SyncStorageItems['sgURLs']): Promise<void> => storage.sync.set({ sgURLs }),
    }
})()
