import { Observable, of, from, merge, BehaviorSubject } from 'rxjs'
import { map, first, defaultIfEmpty, distinctUntilChanged, tap } from 'rxjs/operators'

import { dataOrThrowErrors, gql } from '@sourcegraph/shared/src/graphql/graphql'
import * as GQL from '@sourcegraph/shared/src/graphql/schema'

import { background } from '../../browser-extension/web-extension-api/runtime'
import { observeStorageKey, storage } from '../../browser-extension/web-extension-api/storage'
import { SyncStorageItems } from '../../browser-extension/web-extension-api/types'

export const CLOUD_SOURCEGRAPH_URL = 'https://sourcegraph.com'

export function isCloudSourcegraphUrl(url: string): boolean {
    return url.replace(/\/$/, '') === CLOUD_SOURCEGRAPH_URL
}

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
    const selfHostedSourcegraphURL = new BehaviorSubject<string | undefined>(undefined)
    const currentSourcegraphURL = new BehaviorSubject<string>(CLOUD_SOURCEGRAPH_URL)
    const blocklist = new BehaviorSubject<SyncStorageItems['blocklist'] | undefined>(undefined)

    // eslint-disable-next-line rxjs/no-ignored-subscription
    observeStorageKey('sync', 'sourcegraphURL').subscribe(selfHostedSourcegraphURL)
    // eslint-disable-next-line rxjs/no-ignored-subscription
    observeStorageKey('sync', 'blocklist').subscribe(blocklist)

    const getAllURLs = (rawRepoName?: string): string[] =>
        [rawRepoName && isBlocked(rawRepoName) ? '' : CLOUD_SOURCEGRAPH_URL, selfHostedSourcegraphURL.value].filter(
            Boolean
        ) as string[]

    const isValid = (rawRepoName: string, url: string): boolean => {
        return false
        if (!getAllURLs().includes(url)) {
            return false
        }
        return !isCloudSourcegraphUrl(url) || !isBlocked(rawRepoName)
    }

    const isBlocked = (rawRepoName: string): boolean => {
        const { enabled, content = '' } = blocklist.value ?? {}
        if (!enabled) {
            return false
        }
        const repoPatterns = content.split(/\n+/)
        const match = repoPatterns.find(pattern => new RegExp(pattern).test(rawRepoName))

        console.log('isBlocked =', !!match, rawRepoName)
        return !!match
    }

    const determineSourcegraphURL = async (rawRepoName: string): Promise<string | undefined> => {
        const { cache = {} } = await storage.sync.get('cache')
        console.log('determineSourcegraphURL', rawRepoName)

        const cachedSourcegraphURL = cache[rawRepoName]
        if (cachedSourcegraphURL && isValid(rawRepoName, cachedSourcegraphURL)) {
            return cachedSourcegraphURL
        }

        return merge(
            ...getAllURLs(rawRepoName).map(url =>
                checkRepoCloned(url, rawRepoName).pipe(map(isCloned => [isCloned, url] as [boolean, string]))
            )
        )
            .pipe(
                first(([isCloned]) => isCloned),
                map(([, url]) => url),
                defaultIfEmpty<string | undefined>(undefined),
                tap(url => {
                    if (url) {
                        cache[rawRepoName] = url
                        storage.sync.set({ cache }).catch(console.error)
                    }
                })
            )
            .toPromise()
    }

    return {
        /**
         * Returns currently used Sourcegraph URL
         */
        observe: (isExtension: boolean = true): Observable<string> => {
            if (!isExtension) {
                return of(
                    window.SOURCEGRAPH_URL || window.localStorage.getItem('SOURCEGRAPH_URL') || CLOUD_SOURCEGRAPH_URL
                )
            }

            return currentSourcegraphURL.asObservable().pipe(distinctUntilChanged())
        },
        /**
         * Updates current used Sourcegraph URL based on the current rawRepoName
         */
        use: async (rawRepoName: string): Promise<void> => {
            const sourcegraphURL = await determineSourcegraphURL(rawRepoName)
            if (!sourcegraphURL) {
                console.error(`Couldn't detect sourcegraphURL for the ${rawRepoName}`)
                return
            }

            currentSourcegraphURL.next(sourcegraphURL)
        },
        /**
         * Get self-hosted Sourcegraph URL
         */
        getSelfHostedSourcegraphURL: () => selfHostedSourcegraphURL.asObservable(),
        /**
         * Set self-hosted Sourcegraph URL
         */
        setSelfHostedSourcegraphURL: (sourcegraphURL?: string): Promise<void> => storage.sync.set({ sourcegraphURL }),
        getBlocklist: () => blocklist.asObservable(),
        setBlocklist: (blocklist: SyncStorageItems['blocklist']): Promise<void> => storage.sync.set({ blocklist }),
    }
})()
