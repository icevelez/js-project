import path from 'path';

/**
 * @param {string} dir
 * @param {{ useGzip : boolean }} options
 */
export function serve(dir, { useGzip } = { useGzip: false }) {
    const __dirname = path.join(process.cwd(), dir);

    /**
     * @param {Request} req
     */
    return async (req) => {
        if (req.method !== 'GET') return;

        const filePath = path.join(__dirname, (req.path === '/') ? 'index.html' : req.path);
        if (!filePath.startsWith(__dirname)) return new Response("forbidden", { status: 403 });

        const file = Bun.file(filePath);
        if (!(await file.exists())) return;
        if (!useGzip) return new Response(file);
        return (await gzipResponse(file, req)) || new Response(file);
    }
}

/**
 * @param {Bun.BunFile} file
 * @param {Request} req
 */
async function gzipResponse(file, req) {
    // Only gzip if client supports it
    const accept = req.headers.get("accept-encoding") || "";
    if (!accept.includes("gzip")) return;

    // skip specfic content type from being compressed
    const type = file.type.toLowerCase();
    if (!(
        type.startsWith("text/") ||
        type.includes("json") ||
        type.includes("javascript") ||
        type.includes("xml") ||
        type.includes("svg")
    )) return;

    const buffer = await file.arrayBuffer();

    // small bodies aren't worth gzipping
    if (buffer.byteLength < 512) return;

    const gzipped = Bun.gzipSync(new Uint8Array(buffer));

    return new Response(gzipped, {
        headers: {
            "Content-Type": type,
            "Content-Encoding": "gzip",
            "Content-Length": String(gzipped.byteLength),
            "Vary": "Accept-Encoding"
        },
    });
}
