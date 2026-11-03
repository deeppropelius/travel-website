import fs from "node:fs";
import path from "node:path";
import process from "node:process";
export const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
};
const ROUTE_ALIASES = {
    "/ticket": "/components/ticket.html",
    "/ticket.html": "/components/ticket.html",
    "/e-ticket": "/components/ticket.html",
    "/profile": "/components/profile.html",
    "/profile.html": "/components/profile.html",
    "/destination": "/components/destination-page.html",
    "/destinations": "/components/destination-page.html",
    "/destination-page": "/components/destination-page.html",
    "/destination-page.html": "/components/destination-page.html",
    "/contact": "/components/contact.html",
    "/contact.html": "/components/contact.html",
    "/help": "/components/contact.html",
    "/auth": "/components/auth.html",
    "/auth.html": "/components/auth.html",
    "/login": "/components/auth.html",
    "/signin": "/components/auth.html",
    "/signup": "/components/auth.html",
    "/services": "/components/services.html",
    "/services.html": "/components/services.html",
};
// Directories and files strictly forbidden from static HTTP exposure
const FORBIDDEN_NAMES = new Set([
    "server.js",
    "server.ts",
    "schema.sql",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "services",
    "node_modules",
    "migrate.js",
    "graphify-out",
    ".agents",
]);
// Allowed public directories
const ALLOWED_DIRECTORIES = new Set([
    "components",
    "assets",
    "styles",
    "scripts",
]);
/**
 * Resolves requested path against the root directory and protects against directory traversal,
 * dotfile disclosure, and unauthorized access to backend source code or configuration.
 * Returns absolute path if valid, permitted, and exists as a file, or null otherwise.
 */
export function resolveSafeFilePath(reqPath, rootDir = process.cwd()) {
    try {
        if (!reqPath || typeof reqPath !== "string") {
            return null;
        }
        // Decode URL
        let decoded;
        try {
            decoded = decodeURIComponent(reqPath.split("?")[0].split("#")[0]);
        }
        catch {
            return null;
        }
        // Block path traversal sequences
        if (decoded.includes("..") || decoded.includes("\0")) {
            return null;
        }
        let relativePath = decoded.trim();
        if (relativePath === "/" || relativePath === "") {
            relativePath = "/index.html";
        }
        // Apply route aliases
        const lower = relativePath.toLowerCase();
        if (ROUTE_ALIASES[lower]) {
            relativePath = ROUTE_ALIASES[lower];
        }
        // Strip leading slashes for path segment validation
        const cleanRel = relativePath.replace(/^[/\\]+/, "");
        const segments = cleanRel.split(/[/\\]+/);
        // Reject any hidden files or directories starting with "."
        if (segments.some(s => s.startsWith("."))) {
            return null;
        }
        // Reject known forbidden files and directories
        if (segments.some(s => FORBIDDEN_NAMES.has(s.toLowerCase()))) {
            return null;
        }
        const normalizedRoot = path.resolve(rootDir);
        const checkCandidate = (rel) => {
            const candidatePath = path.resolve(path.join(normalizedRoot, rel));
            // Must be inside the normalized root directory
            if (!candidatePath.startsWith(normalizedRoot)) {
                return null;
            }
            // Check file existence
            if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
                return null;
            }
            const ext = path.extname(candidatePath).toLowerCase();
            const base = path.basename(candidatePath).toLowerCase();
            // Block server script files, sql, map files, or environment files
            if (ext === ".ts" || ext === ".sql" || ext === ".map" || ext === ".lock" || ext === ".env") {
                return null;
            }
            if (FORBIDDEN_NAMES.has(base)) {
                return null;
            }
            // Ensure file resides in an allowed public directory or is an approved root asset
            const relToRoot = path.relative(normalizedRoot, candidatePath);
            const topDir = relToRoot.split(path.sep)[0];
            const isRootApproved = topDir === "index.html" ||
                topDir === "favicon.ico" ||
                topDir === "robots.txt" ||
                topDir === "cities.json";
            if (!isRootApproved && !ALLOWED_DIRECTORIES.has(topDir)) {
                return null;
            }
            return candidatePath;
        };
        // 1. Direct match
        let match = checkCandidate(cleanRel);
        if (match)
            return match;
        // 2. Append .html if extension is omitted
        if (!path.extname(cleanRel)) {
            match = checkCandidate(cleanRel + ".html");
            if (match)
                return match;
            // 3. Check inside components/
            match = checkCandidate(path.join("components", cleanRel + ".html"));
            if (match)
                return match;
        }
        // 4. Check inside components directly
        match = checkCandidate(path.join("components", cleanRel));
        if (match)
            return match;
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
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.writeHead(200);
        fs.createReadStream(safePath).pipe(res);
        return true;
    }
    catch (err) {
        console.error("[fileService] Static serve error:", err);
        return false;
    }
}
