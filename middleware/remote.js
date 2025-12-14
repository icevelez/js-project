import http from 'http';

const byte_to_megabyte = (byte) => byte * 1024 * 1024;

/**
 * @param {{ [key:string] : () => Promise<any> }} remote_fns
 * @param {{ max_request_size_in_mb : number, max_field_size_in_mb : number }} config
 */
export function remoteFunction(remote_fns, config) {
    /**
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage>} res
     */
    return async (req, res) => {
        if (req.method !== 'POST') return;

        const contentType = req.headers["content-type"] || "";

        if (!contentType.startsWith("multipart/form-data")) {
            res.writeHead(400);
            res.end("Content-type must be \"multipart/form-data\"");
            return;
        }

        const boundary = contentType.split("boundary=")[1];
        if (!boundary) {
            res.writeHead(400);
            res.end("Missing boundary");
            return;
        }

        const func_param_data_types = JSON.parse(req.headers['x-func-param-datatypes']);
        if (!Array.isArray(func_param_data_types)) {
            res.writeHead(400);
            res.end(`Function parameter data types invalid`);
            return;
        }

        const func_name = req.headers['x-func-name'];
        const func = func_name ? remote_fns[func_name] : null;
        if (!func_name || !func) {
            res.writeHead(404);
            res.end(`Function "${func_name}" not found`);
            return;
        }

        try {
            const fields = await parseMultipart(req, boundary, func_param_data_types, byte_to_megabyte(config?.max_request_size_in_mb || 0), byte_to_megabyte(config?.max_field_size_in_mb || 0));
            let response = func(...fields);
            if (response instanceof Promise) response = await response;
            res.setHeader('Parse-Type', response && typeof response === "object" ? "json" : "text");
            res.setHeader('Type', response ? typeof response : "text");
            res.setHeader('Content-type', typeof response === "object" ? "application/json" : "plain/text");
            res.end(response && Object.getPrototypeOf(response) === Object.prototype ? JSON.stringify(response) : typeof response === "object" ? response : response?.toString());
        } catch (error) {
            res.statusCode = 500;
            res.end(error.toString());
            return;
        }
    }
}

/**
 * Streaming multipart parser
 * @param {Readable} stream
 * @param {string} boundary
 * @param {string[]} func_param_data_types
 * @param {number} max_request_size
 * @param {number} max_body_size
 */
export function parseMultipart(stream, boundary, func_param_data_types, max_request_size, max_body_size) {
    return new Promise((resolve, reject) => {
        const dashBoundary = "--" + boundary;
        const boundaryBuffer = Buffer.from(dashBoundary);
        const endBoundaryBuffer = Buffer.from(dashBoundary + "--");
        const fields = [];

        let buffer = Buffer.alloc(0);
        let state = "SEARCH_PART"; // SEARCH_PART → HEADERS → BODY
        let headers = "";
        let current = {
            name: null,
            filename: null,
            data: []
        };

        let total_body_size = 0;

        function parseHeaders(headerText) {
            const out = {};
            headerText.split("\r\n").forEach(line => {
                const idx = line.indexOf(":");
                if (idx === -1) return;
                const key = line.slice(0, idx).toLowerCase();
                const val = line.slice(idx + 1).trim();
                out[key] = val;
            });
            return out;
        }

        // Given headers, extract form info
        function setupPart(headers) {
            const disp = headers["content-disposition"];
            if (!disp) return;

            const name = /name="([^"]+)"/.exec(disp)?.[1];
            const filename = /filename="([^"]*)"/.exec(disp)?.[1] || null;

            current = { name, filename, data: [] };
        }

        function finishPart() {
            if (!current.name) return;

            const max_request_size_in_mb = max_request_size / (1024 * 1024);
            const max_body_size_in_mb = max_body_size / (1024 * 1024);

            const data = Buffer.concat(current.data);
            total_body_size += data.byteLength;

            if (max_request_size > 0 && total_body_size >= max_request_size) {
                const error_message = `maximum request size (${max_request_size_in_mb.toFixed(2)}MB) reached`;
                console.error(error_message);
                return reject(error_message);
            }

            if (max_body_size > 0 && data.byteLength >= max_body_size) {
                const error_message = `maximum field size (${max_body_size_in_mb.toFixed(2)}MB) reached`;
                console.error(error_message);
                return reject(error_message);
            }

            const type = func_param_data_types[fields.length];
            if (!type) throw new Error("Missing type");

            if (current.filename) {
                fields[current.name] = current.filename === "json" ? JSON.parse(data.toString("utf8")) : current.filename === "blob" ? new Blob([data]) : new File([data], current.filename);
                return;
            }

            fields[current.name] = data.toString("utf8");
            fields[current.name] = type === "number" ? (fields[current.name] - 0) : type === "boolean" ? Boolean(fields[current.name]) : fields[current.name] === "undefined" ? undefined : fields[current.name] === "null" ? null : fields[current.name];
        }

        stream.on("data", chunk => {
            buffer = Buffer.concat([buffer, chunk]);
            let boundaryIndex;

            while (true) {
                if (state === "SEARCH_PART") {
                    boundaryIndex = buffer.indexOf(boundaryBuffer);
                    if (boundaryIndex === -1) return;
                    buffer = buffer.subarray(boundaryIndex + boundaryBuffer.length);
                    if (buffer.subarray(0, 2).toString() === "--") return resolve(fields);
                    if (buffer.subarray(0, 2).toString() === "\r\n") buffer = buffer.subarray(2);
                    headers = "";
                    state = "HEADERS";
                }

                if (state === "HEADERS") {
                    const headerEnd = buffer.indexOf("\r\n\r\n");
                    if (headerEnd === -1) return; // need more data

                    headers = buffer.subarray(0, headerEnd).toString();
                    buffer = buffer.subarray(headerEnd + 4);

                    setupPart(parseHeaders(headers));
                    state = "BODY";
                }

                if (state === "BODY") {
                    // Look for the next boundary
                    const nextBoundaryPos = buffer.indexOf("\r\n" + dashBoundary);
                    if (nextBoundaryPos === -1) {
                        // all buffer is body data for now
                        current.data.push(buffer);
                        buffer = Buffer.alloc(0);
                        return;
                    }

                    // Body until boundary
                    const bodyChunk = buffer.subarray(0, nextBoundaryPos);
                    current.data.push(bodyChunk);

                    finishPart();

                    // Move buffer after boundary
                    buffer = buffer.subarray(nextBoundaryPos + 2); // skip leading CRLF

                    // Detect -- at end
                    if (buffer.indexOf(endBoundaryBuffer) === 0) return resolve(fields);

                    // Skip boundary + CRLF
                    buffer = buffer.subarray(boundaryBuffer.length);
                    if (buffer.subarray(0, 2).toString() === "\r\n") buffer = buffer.subarray(2);

                    state = "HEADERS";
                }
            }
        });

        stream.on("end", () => resolve(fields));
        stream.on("error", reject);
    });
}
