/** @import { createContext } from "./lib/context.js" */
/** @import { Database } from "bun:sqlite"; */

/**
 * @template {any} T
 */
export default class {

    #database;

    #auth;

    /**
     * @param {Database} database
     * @param {ReturnType<typeof createContext<T>>[1]} auth
     */
    constructor(database, auth) {
        if (!database) throw new Error("no database adaptor");
        if (!auth) throw new Error("no auth adaptor");
        this.#database = database;
        this.#auth = auth;
    }

    /**
     * @param {File} file
     * @param {Date} date
     */
    example_function = async (file, date) => {
        console.log(file, date);

        return {
            message: `Hello from server`,
            map: new Map([[1, "this is an example"], [2, "another example xyz"]]),
            file: new File(['hello'], 'hello_word.txt'),
            test_data: new Date(),
            set: new Set([1, 2, 2, 2, 2, 2, 3, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0]),
        };
    }

    /**
     * Example comment
     * @param {File} file
     */
    upload_file = async (file) => {
        console.log(this.#auth.getContext())
        console.log("Uploaded File:", file);
        return "Upload Sucessful!";
    }
}
