const serialize = (v) => v instanceof Map ? { __t: "Map", v: [...v] } : v instanceof Set ? { __t: "Set", v: [...v] } : v instanceof RegExp ? { __t: "RegExp", v: v.toString() } : v instanceof Date ? { __t: "Date", v: v.toISOString() } : v;
const encode = (obj) => JSON.stringify(obj, (k, v) => serialize(obj[k] || v));

async function remoteFetch(fn_name, headers, args, remote_endpoint) {
    const formData = new FormData();
    for (let i = 0; i < args.length; i++) {
        const arg = serialize(args[i]);
        const is_jsonable = arg && Object.getPrototypeOf(arg) === Object.prototype || Array.isArray(arg);
        formData.append(i, is_jsonable ? new File([encode(arg)], '.json') : arg);
    }

    const response = await fetch(remote_endpoint, {
        method: 'POST',
        headers: {
            ...headers,
            'x-func-name': fn_name,
            'x-func-param-datatypes': JSON.stringify(args.map((arg) => arg == null ? "null" : arg === undefined ? "undefined" : typeof arg)),
        },
        body: formData,
    })

    if (response.status >= 400) throw new Error(await response.text());
    if (response.status < 200 || response.status > 299 || response.status === 204) return;

    const data = await response[response.headers.get('content-type') === 'application/json' ? 'json' : 'text']();
    const response_type = response.headers.get("type");

    return (response_type === "number") ? +data : (response_type === "boolean") ? Boolean(data) : data;
}

/**
 * @param {string} remote_endpoint
 * @param {Record<string, string>} headers
 */
export function connectRemote(remote_endpoint, headers = {}) {
    return new Proxy({}, {
        get(_, fn_name) {
            return (...args) => remoteFetch(fn_name, headers, args, remote_endpoint)
        },
    });
}
