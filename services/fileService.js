import fs from "node:fs";
import path from "node:path";
import process from "node:process";
export const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ts": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
};
/**
 * Resolves requested path against the root directory and protects against directory traversal.
 * Returns absolute path if valid and exists as a file, or null otherwise.
 */
export function resolveSafeFilePath(reqPath, rootDir = process.cwd()) {
    try {
        let relativePath = decodeURIComponent(reqPath);
        if (relativePath === "/" || relativePath === "") {
            relativePath = "/index.html";
        }
        const safePath = path.normalize(path.join(rootDir, relativePath));
        // Ensure path remains inside target directory to prevent directory traversal
        if (!safePath.startsWith(rootDir)) {
            return null;
        }
        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
            return safePath;
        }
    }
    catch (err) {
        console.error("[fileService] Error resolving path:", err);
    }
    return null;
}
/**
 * Streams a static file to the HTTP response with appropriate Content-Type and CORS headers.
 * Returns true if the file was handled and served, false otherwise.
 */
export function serveStaticFile(reqPath, res, rootDir = process.cwd()) {
    try {
        const safePath = resolveSafeFilePath(reqPath, rootDir);
        if (!safePath) {
            return false;
        }
        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.writeHead(200);
        fs.createReadStream(safePath).pipe(res);
        return true;
    }
    catch (err) {
        console.error("[fileService] Static serve error:", err);
        return false;
    }
}
