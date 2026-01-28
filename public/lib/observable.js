export class Observable {

    /** @type {Set<(data:any) => void>} */
    #subscribers = new Set();

    constructor() { }

    /**
     * @param {(data:any) => void} fn
     */
    subscribe = (fn) => {
        if (typeof fn !== "function") throw new Error("fn is not a function");
        this.#subscribers.add(fn);
        return () => this.#subscribers.delete(fn);
    }

    /**
     * @param {any} data
     */
    notify = (data) => {
        this.#subscribers.forEach((subscribers) => subscribers(data));
    }

    size = () => this.#subscribers.size;
}
