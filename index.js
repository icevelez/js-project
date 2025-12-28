import { Database } from "bun:sqlite";
import { HttpMux } from "./lib/http.bun.js";
import { createContext } from "./lib/context.js";
import { serve } from "./middleware/serve.js";
import { remoteFunction } from "./middleware/remote.js";
import Remote from "./remote_api.js";

const database = new Database(":memory:");

const [authContextMiddle, getAuthContext] = createContext((request) => {
    const auth_key = request.headers.get('x-auth') || "";
    if (auth_key) return auth_key;
    return new Response("context unauthorized", { status: 401 });
})

const remote_functions = new Remote(database, getAuthContext);

const rpcMux = new HttpMux();
rpcMux.handle("/api/remote", authContextMiddle);
rpcMux.handle("/api/remote", remoteFunction(remote_functions, { max_request_size_in_mb: 1 }));

const mux = new HttpMux();
mux.handle("/", serve('public'));
mux.handle("/", rpcMux.strip_prefix());
mux.serveTLS("ssl/default.key", "ssl/default.cert", 3000);
