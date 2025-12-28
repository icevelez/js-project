/**
 * @template {any} T
 * @param {(request:Request, response:Response) => T | Response]} fn
 * @returns {[(req:Request, res:Response) => (Response | void), () => T]}
 */
export function createContext(fn) {
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
