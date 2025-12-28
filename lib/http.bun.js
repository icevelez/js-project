
export class HttpMux {

    /** @typedef {{ children?: Map<string, Node>, param?: Node, paramName?: string, wildcard?: Node, handler?: Function, stack?: Function[] }} Node */

    #is_serving = false;
    #is_serving_https = false;

    /** @type {Map<string, Node>} */
    #routes = new Map();

    #mwCounter = 0;
    /** @type {{ children : Map<string, Node>, stack : Function[] }} */
    #middlewareTree = {            // prefix router
        children: new Map(),
        stack: []
    };


    #findRoute(req) {
        const parts = req.path.split("/").filter(Boolean);
        const root = this.#routes.get(req.method);
        if (!root) return null;

        let node = root;
        const params = new Map();

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (node.children?.has(part)) {
                node = node.children.get(part);
            } else if (node.param) {
                params.set(node.param.paramName, part);
                node = node.param;
            } else if (node.wildcard) {
                params.set("wildcard", parts.slice(i).join("/"));
                node = node.wildcard;
                break;
            } else {
                return null;
            }
        }

        return node?.handler ? { maxMiddlewareId: node.maxMiddlewareId, handler: node.handler, params } : null;
    }

    async #runMiddleware(req, maxId) {
        const parts = req.path.split("/").filter(Boolean);
        let node = this.#middlewareTree;

        for (const { fn, id } of node.stack) {
            if (maxId > -1 && id > maxId) continue;
            let value = fn(req);
            if (value instanceof Promise) value = await value;
            if (value === undefined) continue;
            if (value instanceof Response) return value;
            return new Response(value);
        }

        for (const part of parts) {
            if (!node.children.has(part)) break;
            node = node.children.get(part);

            for (const { fn, id } of node.stack) {
                if (maxId > -1 && id > maxId) continue
                let value = fn(req);
                if (value instanceof Promise) value = await value;
                if (value === undefined) continue;
                if (value instanceof Response) return value;
                return new Response(value);
            }
        }
    }

    constructor() { }

    /**
     * @param {string} port
     * @param {string} hostname
     */
    serve = (port, hostname = "localhost") => new Promise((resolve, reject) => {
        if (this.#is_serving) return console.error("Web server is already running");
        this.#is_serving = true;

        const mux = this.strip_prefix();
        Bun.serve({
            port,
            hostname,
            fetch(request) {
                return mux(request);
            },
        });
    })

    /**
     * @param {string} tls_cert
     * @param {string} tls_key
     * @param {string} port
     * @param {string} hostname
     */
    serveTLS = (key, cert, port, hostname = "localhost") => new Promise((resolve, reject) => {
        if (this.#is_serving_https) return console.error("Web server is already running");
        this.#is_serving_https = true;

        // const ssl_option = { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
        const mux = this.strip_prefix();
        Bun.serve({
            port,
            hostname,
            key: Bun.file(key),
            cert: Bun.file(cert),
            fetch(request) {
                return mux(request);
            },
        });
    })

    /**
     * @param {string} method_and_path
     * @param {(request:Request) => void} fn
     */
    handleFunc = (method_and_path, fn) => {
        const [method, path] = method_and_path.split(" ");
        const parts = path.split("/").filter(Boolean);

        let root = this.#routes.get(method);
        if (!root) {
            root = { children: new Map() };
            this.#routes.set(method, root);
        }

        let node = root;
        if (node.handler) {
            console.trace(`Route "${method} ${path}" already has a handler`);
            process.exit(-1);
        }

        for (const part of parts) {
            if (part === "*") {
                node.wildcard ??= {};
                node = node.wildcard;
                break;
            } else if (part[0] === ":") {
                node.param ??= { paramName: part.slice(1) };
                node = node.param;
            } else {
                node.children ??= new Map();
                if (!node.children.has(part)) node.children.set(part, {});
                node = node.children.get(part);
            }
        }

        node.handler = fn;
        node.maxMiddlewareId = this.#mwCounter;   // snapshot!
    }

    /**
     * @param {string} path
     * @param {(request) => void | Promise<void>} fn
     */
    handle = (path, fn) => {
        const id = ++this.#mwCounter;
        const parts = path.split("/").filter(Boolean);

        let node = this.#middlewareTree;

        for (const p of parts) {
            if (!node.children.has(p)) node.children.set(p, { children: new Map(), stack: [] });
            node = node.children.get(p);
        }

        node.stack.push({ fn, id });
    };

    /**
     * @param {string} strip_prefix
     */
    strip_prefix = (strip_prefix = "") => {
        /**
         * @param {Request} request
         */
        return async (request) => {
            const path = request.url.split(request.headers.get("host"))[1].split("?")[0];
            request.path = path;
            const match = this.#findRoute(request);

            const middleware_value = await this.#runMiddleware(request, match?.maxMiddlewareId);
            if (middleware_value instanceof Response) return middleware_value;

            if (!match) return new Response("not found", { status: 404 });

            request.pathParams = match.params;
            const value = match.handler(request);
            if (value instanceof Promise) return await value;
            return value;
        }
    }
}
