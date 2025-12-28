import fs from 'fs/promises';
import path from 'path';

/**
 * @param {string} dir
 */
export function serve(dir) {
    const __dirname = path.join(process.cwd(), dir);

    /**
     * @param {Request} req
     */
    return async (req) => {
        if (req.method !== 'GET') return;

        const filePath = path.join(__dirname, (req.path === '/') ? 'index.html' : req.path);
        if (!filePath.startsWith(__dirname)) return new Response("forbidden", { status: 403 });

        try {
            const file = Bun.file(filePath);
            return new Response(file)
        } catch (error) {
            // ignore non-existent files
            // console.error(error);
            return;
        }
    }
}
