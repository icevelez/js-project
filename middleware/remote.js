import { randomUUID } from 'crypto';

/** @import { Request, Response } from '../lib/http.node.js' */

const byte_to_megabyte = (byte) => byte * 1024 * 1024;

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
                if (isNaN(parseInt(key))) return console.log("not a number", key);
                fields[key] = decode(value, reqformData);
            })

            let response = func(...fields);
            if (response instanceof Promise) response = await response;

            const formData = new FormData();
            const encoded_response = response && typeof response === "object" ? encode(response, formData) : response;

            if (encoded_blobs_idx > 0) {
                encoded_blobs_idx = 0;
                formData.append(0, encoded_response);
                return new Response(formData);
            }

            return new Response(encoded_response === true ? `${encoded_response}` : encoded_response, {
                'Data-Type': response ? typeof response : "text",
                'Content-type': response instanceof File || response instanceof Blob ? "application/octet-stream" : typeof response === "object" ? "application/json" : "plain/text"
            })
        } catch (error) {
            return new Response(error.toString(), { status: 500 });
        }
    }
}

const deserialization_map = { "Date": (v) => new Date(v), "RegExp": (v) => new RegExp(v), "Set": (v) => new Set(v), "Map": (v) => new Map(v) };
const deserialize = (v) => deserialization_map[v?.__t] ? deserialization_map[v.__t](v.v) : v;
/**
 * @param {string} json
 * @param {FormData} fields
 */
const decode = (json, fields) => JSON.parse(json, (_, v) => (v?.__b >= 0) ? fields.get(`blob-${v.__b}`) : deserialize(v));

const serialize = (v) => v instanceof Map ? { __t: "Map", v: [...v] } : v instanceof Set ? { __t: "Set", v: [...v] } : v instanceof RegExp ? { __t: "RegExp", v: v.toString() } : v instanceof Date ? { __t: "Date", v: v.toISOString() } : v;

let encoded_blobs_idx = 0;

/**
 *
 * @param {any} obj
 * @param {FormData} formData
 */
const encode = (obj, formData) => JSON.stringify(obj, (k, v) => {
    if (v instanceof File || v instanceof Blob) {
        formData.append(`blob-${encoded_blobs_idx}`, v);
        return { __b: encoded_blobs_idx++ };
    }
    return serialize(obj[k] || v);
});
