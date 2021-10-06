/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export const logger = {
    info: (...args: any): void => {
        console.info('[Sourcegraph]', ...args)
    },
}
