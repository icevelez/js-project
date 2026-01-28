let context_headers = {}
let context_status = 200;

/** @type {Request} */
let context_request;

/**
 * @param {(headers:{ [key:string] : string}) => void} headers
 * @param {number} status
 */
export function remoteSetHeaders(headers, status = 0) {
    context_headers = headers;
    if (status) {
        status = (typeof status !== "number" ? parseInt(status) : status) || 500;
        status = status < 0 ? 500 : status > 599 ? 500 : status;
        context_status = status;
    }
}

export function remoteGetRequest() {
    return context_request;
}

/**
 * @param {{ [key:string] : () => Promise<any> }} remote_fns
 * @param {{ max_request_size_in_mb : number, max_field_size_in_mb : number }} config
 */
export function remoteFunction(remote_fns, config) {
    /**
     * @param {Request} req
     */
    return async (req) => {
        if (req.method !== 'POST') return;

        const contentType = req.headers.get("content-type") || "";
        if (!contentType.startsWith("multipart/form-data")) return new Response("Content-type must be \"multipart/form-data\"", { status: 400 });

        const boundary = contentType.split("boundary=")[1];
        if (!boundary) return new Response(`Missing boundary`, { status: 400 });

        const func_param_data_types = JSON.parse(req.headers.get('x-func-param-datatypes'));
        if (!Array.isArray(func_param_data_types)) return new Response(`Function parameter data types invalid`, { status: 400 });

        const func_name = req.headers.get('x-func-name');
        const func = func_name ? remote_fns[func_name] : null;
        if (!func_name || !func) return new Response(`Function "${func_name}" not found`, { status: 404 });

        try {
            const reqformData = await req.formData();
            const fields = [];

            reqformData.forEach((value, key) => {
                if (isNaN(parseInt(key))) return;
                fields[key] = func_param_data_types[key] === "object" ? remote_decode(value, reqformData) : func_param_data_types[key] === "boolean" ? value === "true" : func_param_data_types[key] === "number" ? +value : value;
            })

            context_request = req;
            let response = func(...fields);
            if (response instanceof Promise) response = await response;

            const formData = new FormData();
            const encoded_response = response && typeof response === "object" ? remote_encode(response, formData) : response === true ? `${response}` : response;

            if (encoded_blobs_idx > 0) {
                encoded_blobs_idx = 0;
                formData.append(0, encoded_response);
                return new Response(formData);
            }

            const current_headers = context_headers;
            context_headers = {}; // reset headers

            const status = context_status;
            context_status = 200; // reset status

            return new Response(encoded_response, {
                status,
                headers: {
                    ...current_headers,
                    'Data-Type': (response || response === false) ? typeof response : "text",
                    'Content-type': response instanceof File || response instanceof Blob ? "application/octet-stream" : typeof response === "object" ? "application/json" : "plain/text"
                }
            })
        } catch (error) {
            const status = context_status;
            context_status = 200; // reset status
            return new Response(error.toString(), { status });
        }
    }
}

const deserialization_map = { "Date": (v) => new Date(v), "RegExp": (v) => new RegExp(v), "Set": (v) => new Set(v), "Map": (v) => new Map(v) };
const deserialize = (v) => deserialization_map[v?.__t] ? deserialization_map[v.__t](v.v) : v;
export const remote_decode = (json, form) => JSON.parse(json, (_, v) => (v?.__b >= 0) ? form.get(`blob-${v.__b}`) : deserialize(v));

let encoded_blobs_idx = 0;
const serialize = (v) => v instanceof Map ? { __t: "Map", v: [...v] } : v instanceof Set ? { __t: "Set", v: [...v] } : v instanceof RegExp ? { __t: "RegExp", v: v.toString() } : v instanceof Date ? { __t: "Date", v: v.toISOString() } : v;
export const remote_encode = (obj, formData) => {
    const originalDateToJSON = Date.prototype.toJSON;
    Date.prototype.toJSON = undefined;
    try {
        return (obj && obj instanceof Date) ? JSON.stringify(serialize(obj)) : JSON.stringify(obj, (_, v) => {
            if (!(v instanceof File || v instanceof Blob)) return serialize(v);
            formData.append(`blob-${encoded_blobs_idx}`, v);
            return { __b: encoded_blobs_idx++ };
        })
    } finally {
        Date.prototype.toJSON = originalDateToJSON;
    }
};
