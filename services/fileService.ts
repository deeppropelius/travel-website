import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { ServerResponse } from "node:http";

export const MIME_TYPES: Record<string, string> = {
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

const ROUTE_ALIASES: Record<string, string> = {
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
};

/**
 * Resolves requested path against the root directory and protects against directory traversal.
 * Returns absolute path if valid and exists as a file, or null otherwise.
 */
export function resolveSafeFilePath(reqPath: string, rootDir: string = process.cwd()): string | null {
  try {
    let relativePath = decodeURIComponent(reqPath.split("?")[0].split("#")[0]);
    if (relativePath === "/" || relativePath === "") {
      relativePath = "/index.html";
    }

    // Check direct aliases
    const lower = relativePath.toLowerCase();
    if (ROUTE_ALIASES[lower]) {
      relativePath = ROUTE_ALIASES[lower];
    }

    const checkCandidate = (rel: string): string | null => {
      const safe = path.normalize(path.join(rootDir, rel));
      if (safe.startsWith(rootDir) && fs.existsSync(safe) && fs.statSync(safe).isFile()) {
        return safe;
      }
      return null;
    };

    // 1. Direct match
    let match = checkCandidate(relativePath);
    if (match) return match;

    // 2. Append .html if not present
    if (!path.extname(relativePath)) {
      match = checkCandidate(relativePath + ".html");
      if (match) return match;

      // 3. Check inside components/
      match = checkCandidate(path.join("components", relativePath + ".html"));
      if (match) return match;
    }

    // 4. Check inside components directly
    match = checkCandidate(path.join("components", relativePath));
    if (match) return match;
  } catch (err) {
    console.error("[fileService] Error resolving path:", err);
  }

  return null;
}

/**
 * Streams a static file to the HTTP response with appropriate Content-Type and CORS headers.
 * Returns true if the file was handled and served, false otherwise.
 */
export function serveStaticFile(reqPath: string, res: ServerResponse | any, rootDir: string = process.cwd()): boolean {
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
  } catch (err) {
    console.error("[fileService] Static serve error:", err);
    return false;
  }
}
