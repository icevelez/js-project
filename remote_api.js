/** @import { authInstance } from "./lib/auth.js" */
/** @import { Pool } from "pg"; */

/**
 * @template {any} T
 */
export default class {

    /** @type {Pool} */
    #database = null;

    /** @type {ReturnType<typeof authInstance<any>>['context']} */
    #auth;

    /**
     * @param {any} database
     * @param {ReturnType<typeof authInstance<T>>['context']} auth
     */
    constructor(database, auth) {
        if (!database) throw new Error("no database adaptor");
        if (!auth) throw new Error("no auth adaptor");
        this.#database = database;
        this.#auth = auth;
    }

    example_function = async (data, ...args) => {
        const user_data = this.#auth.getContext();
        if (!user_data) throw new Error("no user. unauthorized");

        // await this.#database.query("SOME SQL INSERT EXAMPLE", data);

        console.log(data, args);

        return { message: `Hello from server ${user_data}` };
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
