import path from "path";

export default class {

    /** @type {Bun.SQL} */
    #database;
    #get_auth_context;
    #sse_notify;

    #upload_dir = path.resolve("public/assets/pictures");

    /**
     * @param {Bun.SQL} database
     * @param {() => ({ id:number, username:string, admin:boolean })} get_auth_context
     * @param {(data:any) => void} sse_notify
     */
    constructor(database, get_auth_context, sse_notify) {
        if (!database) throw new Error("no database adaptor");
        if (!get_auth_context) throw new Error("no get_context");
        if (!sse_notify) throw new Error("no sse_notify");
        this.#database = database;
        this.#get_auth_context = get_auth_context;
        this.#sse_notify = sse_notify;
    }

    /**
     * @param {number} num1
     * @param {number} num2
     */
    add_numbers = async (num1, num2) => {
        if (!this.#get_auth_context().admin) throw new Error("not an admin");

        const add = num1 + num2;
        this.#sse_notify(add);
        return add;
    }

    /**
     * @param {Blob} picture_blob
     * @param {string} filename
     */
    upload_picture = async (picture_blob, filename) => {
        if (picture_blob?.size <= 0) return false;

        const resolvedPath = path.resolve(this.#upload_dir, `${filename}.webp`);
        if (!resolvedPath.startsWith(this.#upload_dir)) throw new Error("Invalid path");

        Bun.write(resolvedPath, picture_blob)

        return true;
    }


    /**
     * @param {string} filename
     */
    delete_picture = async (filename) => {
        if (!filename) return false;
        const resolvedPath = path.resolve(this.#upload_dir, `${filename}.webp`);
        if (!resolvedPath.startsWith(this.#upload_dir)) throw new Error("Invalid path");
        Bun.file(resolvedPath).delete();
        return true;
    }
}
