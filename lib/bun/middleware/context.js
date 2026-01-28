/**
 * @template {any} T
 * @param {(req:Request) => (T | Response | Promise<Response> | Promise<T>)} fn
 * @returns {[(req:Request) => void, () => T]}
 */
export function createContext(fn) {
    /** @type {T} */
    let context;
    return [
        async (req) => {
            context = fn(req);
            if (context instanceof Response) return context;
            if (context instanceof Promise) context = await context;
        },
        () => context
    ];
}
