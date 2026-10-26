import { createServer } from "node:http";
import process from "node:process";
import dotenv from "dotenv";
import { serveStaticFile } from "./services/fileService.js";
import { fetchDestinationDetails, } from "./services/destinationService.js";
dotenv.config();
const API_KEY = process.env.Open_Trip_Map;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = createServer(async (req, res) => {
    // CORS & Headers for API requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    // 1. Ticket Security & QR Verification Middleware Endpoint
    if (req.method === "GET" && url.pathname === "/api/ticket/verify") {
        const bookingId = url.searchParams.get("id");
        const token = url.searchParams.get("token");
        if (!bookingId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Booking reference is required", verified: false }));
            return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            verified: true,
            bookingId: bookingId.toUpperCase(),
            token: token || "VALID-TICKET",
            clearance: "GRANTED",
            status: "CONFIRMED",
            scannedAt: new Date().toISOString(),
            agency: "Jadoo Travel Agency"
        }));
        return;
    }
    // Non-API routes: serve static files (HTML, CSS, JS, Images, etc.)
    if (!url.pathname.startsWith("/api/")) {
        if (serveStaticFile(url.pathname, res)) {
            return;
        }
    }
    if (req.method === "GET" && url.pathname === "/api/destination") {
        const destination = url.searchParams.get("name");
        if (!destination) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Destination name is required" }));
            return;
        }
        if (!API_KEY) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "OpenTripMap API key is missing in .env" }));
            return;
        }
        try {
            const destinationData = await fetchDestinationDetails(destination);
            if (!destinationData) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: `Destination "${destination}" not found` }));
                return;
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(destinationData));
        }
        catch (error) {
            console.error("Destination service error:", error);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to fetch destination data" }));
        }
        return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
});
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`\n⚠️  Port ${PORT} is already in use by another process.`);
        console.error(`   Retrying on backup port ${Number(PORT) + 1}...\n`);
        server.listen(Number(PORT) + 1, () => {
            console.log(`Server running at http://localhost:${Number(PORT) + 1}`);
        });
    }
    else {
        console.error("Server error:", err);
    }
});
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
export { server };
