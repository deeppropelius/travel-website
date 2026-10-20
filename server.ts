import { createServer } from "node:http";
import process from "node:process";
import dotenv from "dotenv";
import { serveStaticFile } from "./services/fileService.js";
import {
  getDestinationCoordinates,
  getNearbyPlaces,
  fetchDestinationDetails,
} from "./services/destinationService.js";

dotenv.config();

const API_KEY = process.env.Open_Trip_Map;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = createServer(async (req: any, res: any) => {
  // CORS & Headers for API requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

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
    } catch (error) {
      console.error("Destination service error:", error);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to fetch destination data" }));
    }

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { server };
