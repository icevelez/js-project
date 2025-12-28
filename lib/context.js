/** @import { Request, Response } from './http' */

/**
 * @template {any} T
 * @param {(request:Request, response:Response) => T} fn
 * @returns {[(req:Request, res:Response) => void, () => T]}
 */
export function createContext(fn) {
    let context;
    return [
        async (req, res) => {
            context = fn(req, res);
            if (context instanceof Promise) context = await context;
        },
        () => context
    ];
}
