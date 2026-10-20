import { createServer } from "node:http";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Load cities.json dataset (around 130,000+ cities worldwide)
const citiesData = require("cities.json");

interface CityRecord {
  name: string;
  lat: string;
  lng: string;
  country: string;
  admin1?: string;
  admin2?: string;
}

const citiesList: CityRecord[] = citiesData as CityRecord[];

// Famous country mapping for high-traffic cities with duplicate names across countries
const famousCityCountryMap: Record<string, string> = {
  paris: "FR",
  dubai: "AE",
  rome: "IT",
  london: "GB",
  berlin: "DE",
  madrid: "ES",
  tokyo: "JP",
  "new york": "US",
  cairo: "EG",
  sydney: "AU",
  toronto: "CA",
  barcelona: "ES",
  venice: "IT",
  florence: "IT",
  milan: "IT",
  amsterdam: "NL",
  vienna: "AT",
  bangkok: "TH",
  singapore: "SG",
  seoul: "KR",
  delhi: "IN",
  mumbai: "IN",
  beijing: "CN",
  shanghai: "CN",
  agra: "IN",
};

// Check cities.json dataset first
function getCityFromDataset(
  cityName: string
): { title: string; country: string; latitude: number; longitude: number; source: string } | null {
  const norm = cityName.trim().toLowerCase();
  const matches = citiesList.filter((c) => c.name.toLowerCase() === norm);

  if (matches.length === 0) return null;

  if (matches.length === 1) {
    const c = matches[0];
    return {
      title: c.name,
      country: c.country,
      latitude: parseFloat(c.lat),
      longitude: parseFloat(c.lng),
      source: "cities.json",
    };
  }

  // Check known world city mapping for duplicates
  const preferredCountry = famousCityCountryMap[norm];
  if (preferredCountry) {
    const found = matches.find((c) => c.country === preferredCountry);
    if (found) {
      return {
        title: found.name,
        country: found.country,
        latitude: parseFloat(found.lat),
        longitude: parseFloat(found.lng),
        source: "cities.json",
      };
    }
  }

  // Default to capital or primary administrative entity if available
  const primary = matches.find((c) => !c.admin2 || c.admin2 === "");
  const chosen = primary || matches[0];
  return {
    title: chosen.name,
    country: chosen.country,
    latitude: parseFloat(chosen.lat),
    longitude: parseFloat(chosen.lng),
    source: "cities.json",
  };
}

const WIKI_HEADERS = {
  "User-Agent": "JadooTravelApp/1.0 (https://jadoo-travel.example.com; contact@jadootravel.com) node-fetch",
};

// Search coordinates from Wikipedia
async function getCoordinatesFromWiki(
  place: string
): Promise<{ title: string; latitude: number; longitude: number; country?: string; source: string; page?: any } | null> {
  const wikipedia = new URL("https://en.wikipedia.org/w/api.php");
  wikipedia.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: place,
    gsrnamespace: "0",
    gsrlimit: "1",
    prop: "coordinates|pageimages|extracts|description|info",
    piprop: "thumbnail",
    pithumbsize: "600",
    exintro: "1",
    explaintext: "1",
    exchars: "300",
    inprop: "url",
    colimit: "1",
    origin: "*",
  }).toString();

  const response = await fetch(wikipedia, { headers: WIKI_HEADERS });

  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }

  const data = await response.json();
  const pages = data.query?.pages;

  if (!pages) return null;

  const page = Object.values(pages)[0] as any;
  const coords = page.coordinates?.[0];

  if (!coords) return null;

  return {
    title: page.title,
    latitude: coords.lat,
    longitude: coords.lon,
    source: "wikipedia",
    page: page,
  };
}

// Master resolver: checks cities.json first, and if not found, falls back to Wikipedia
async function getDestinationCoordinates(
  place: string
): Promise<{ title: string; latitude: number; longitude: number; country?: string; source: string; page?: any } | null> {
  // 1. Try cities.json first
  const cityMatch = getCityFromDataset(place);
  if (cityMatch) {
    console.log(`[Geocode] Found "${place}" in cities.json (${cityMatch.country}) at [${cityMatch.latitude}, ${cityMatch.longitude}]`);
    return cityMatch;
  }

  // 2. Fallback to Wikipedia for landmarks, islands, or unlisted locations
  console.log(`[Geocode] "${place}" not in cities.json, searching Wikipedia...`);
  const wikiMatch = await getCoordinatesFromWiki(place);
  if (wikiMatch) {
    console.log(`[Geocode] Found "${place}" on Wikipedia at [${wikiMatch.latitude}, ${wikiMatch.longitude}]`);
    return wikiMatch;
  }

  return null;
}

// Deterministic helper to generate consistent travel pricing, ratings & reviews per place
function getPlaceTravelMeta(name: string, index: number) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  // Price in USD ($20 to $150 entry/tour ticket)
  const basePrices = [25, 35, 45, 50, 65, 80, 95, 120, 140, 30, 40, 75, 110, 85, 150];
  const amount = basePrices[index % basePrices.length] + (posHash % 15);
  const price = `$${amount}`;

  // Rating (4.4 to 4.9)
  const rating = Number((4.3 + ((posHash % 7) * 0.1)).toFixed(1));

  // Reviews count (150 to 3,800)
  const reviews = 150 + (posHash % 3200);

  // Travel badge
  const badges = ["Top Rated", "Bestseller", "Popular", "Must Visit", "Historical"];
  const badge = badges[posHash % badges.length];

  // Duration
  const durations = ["2-3 Hours", "Half Day", "Full Day", "1-2 Hours", "3-4 Hours"];
  const duration = durations[posHash % durations.length];

  return { price, amount, currency: "USD", rating, reviews, badge, duration };
}

type PlaceDetail = {
  name: string;
  kinds: string;
  description: string;
  img: string | null;
  image: string | null;
  preview?: { source: string };
  price: string;
  amount: number;
  currency: string;
  rating: number;
  reviews: number;
  badge?: string;
  duration: string;
  url?: string;
  point?: { lat: number; lon: number };
};

async function getNearbyPlaces(
  destinationName: string,
  lat: number,
  lon: number,
  limit: number = 30,
  destPage?: any
): Promise<PlaceDetail[]> {
  // 1. Search for world-famous attractions & landmarks specifically in this destination
  const wikiSearch = new URL("https://en.wikipedia.org/w/api.php");
  wikiSearch.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `attractions in ${destinationName} OR landmarks in ${destinationName}`,
    gsrlimit: "35",
    prop: "pageimages|description|extracts|coordinates|info",
    piprop: "thumbnail",
    pithumbsize: "600",
    exintro: "1",
    explaintext: "1",
    exchars: "220",
    inprop: "url",
    origin: "*",
  }).toString();

  // 2. Geosearch around coordinates (Wikipedia maximum ggsradius is 10000)
  const wikiGeo = new URL("https://en.wikipedia.org/w/api.php");
  wikiGeo.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: "10000",
    ggslimit: "50",
    prop: "pageimages|description|extracts|coordinates|info",
    piprop: "thumbnail",
    pithumbsize: "600",
    exintro: "1",
    explaintext: "1",
    exchars: "220",
    inprop: "url",
    origin: "*",
  }).toString();

  const [searchRes, geoRes] = await Promise.all([
    fetch(wikiSearch, { headers: WIKI_HEADERS }).then((r) =>
      r.ok ? r.json() : { query: { pages: {} } }
    ),
    fetch(wikiGeo, { headers: WIKI_HEADERS }).then((r) =>
      r.ok ? r.json() : { query: { pages: {} } }
    ),
  ]);

  const searchPages = Object.values(searchRes.query?.pages || {}) as any[];
  const geoPages = Object.values(geoRes.query?.pages || {}) as any[];

  // Non-tourist filter to strictly remove non-sightseeing items
  const nonTourist = /(station|metro|railway|subway|airport|embassy|consulate|school|college|university|hospital|organisation|organization|company|bank|headquarters|police|depot|cemetery|barracks|library|institute|ministry|office|bureau|department|prison|court|prefecture|commune|massacre|bombing|battle|siege|ceremony|opening|revolution|disaster|fire|crash|attack|nightclub|brothel|treaty|syndrome|arrondissement|constituency|culture of|history of|demographics of|outline of|tourism in|lists of|timeline of|mayor of|politics of|economy of|geography of)/i;

  // Positive tourist keywords indicating iconic sights/landmarks
  const touristKeywords = /(tower|museum|palace|cathedral|basilica|church|temple|monument|statue|fountain|bridge|park|garden|square|plaza|theatre|theater|opera|château|castle|art|sculpture|gallery|landmark|attraction|aquarium|zoo|promenade|sanctuary|abbey|pyramid|colosseum|acropolis|amphitheatre|fort|fortress|island|resort|beach)/i;

  const combinedMap = new Map<string, any>();

  // If the destination itself is an attraction (e.g. Ko Lamphu, Eiffel Tower, Central Park), include it first!
  if (destPage && destPage.thumbnail?.source) {
    combinedMap.set(destPage.title, {
      ...destPage,
      fameScore: 999999,
    });
  }

  const processPage = (p: any, fromSearch: boolean) => {
    if (!p.thumbnail?.source || p.title?.startsWith("List of ")) return;

    const fullText = `${p.title} ${p.description || ""}`.toLowerCase();
    if (nonTourist.test(fullText)) return;

    // Geographic verification if page has coordinates
    if (p.coordinates?.[0]) {
      const dLat = Math.abs(p.coordinates[0].lat - lat);
      const dLon = Math.abs(p.coordinates[0].lon - lon);
      // Skip if beyond ~60 km of the destination
      if (dLat > 0.6 || dLon > 0.6) return;
    } else if (fromSearch) {
      if (!fullText.includes(destinationName.toLowerCase())) return;
    }

    if (!combinedMap.has(p.title)) {
      let fameBonus = (fromSearch ? 100000 : 0) + (p.length || 0);
      if (touristKeywords.test(fullText)) fameBonus += 50000;

      combinedMap.set(p.title, {
        ...p,
        fameScore: fameBonus,
      });
    }
  };

  searchPages.forEach((p) => processPage(p, true));
  geoPages.forEach((p) => processPage(p, false));

  const sortedPages = Array.from(combinedMap.values())
    .sort((a, b) => b.fameScore - a.fameScore)
    .slice(0, limit);

  return sortedPages.map((p, idx) => {
    const meta = getPlaceTravelMeta(p.title, idx);
    const cleanExtract = p.extract ? p.extract.replace(/\s+/g, " ").trim() : "";
    const description =
      cleanExtract || p.description || "A famous tourist landmark popular with travelers.";

    return {
      name: p.title,
      kinds: p.description || "Famous Attraction",
      description: description,
      img: p.thumbnail.source,
      image: p.thumbnail.source,
      preview: { source: p.thumbnail.source },
      price: meta.price,
      amount: meta.amount,
      currency: meta.currency,
      rating: meta.rating,
      reviews: meta.reviews,
      badge: meta.badge,
      duration: meta.duration,
      url: p.fullurl,
      point: p.coordinates?.[0]
        ? { lat: p.coordinates[0].lat, lon: p.coordinates[0].lon }
        : undefined,
    };
  });
}

const API_KEY = process.env.Open_Trip_Map;
const BASE_URL = "https://api.opentripmap.com/0.1/en/places";

const MIME_TYPES: Record<string, string> = {
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

function serveStaticFile(reqPath: string, res: any): boolean {
  try {
    let relativePath = decodeURIComponent(reqPath);
    if (relativePath === "/" || relativePath === "") {
      relativePath = "/index.html";
    }
    const safePath = path.normalize(path.join(process.cwd(), relativePath));
    if (!safePath.startsWith(process.cwd())) {
      return false;
    }
    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.writeHead(200);
      fs.createReadStream(safePath).pipe(res);
      return true;
    }
  } catch (err) {
    console.error("Static serve error:", err);
  }
  return false;
}

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

  const url = new URL(req.url ?? "/", "http://localhost:3000");

  // Non-API routes: serve static files (HTML, CSS, JS, Images, etc.)
  if (!url.pathname.startsWith("/api/")) {
    if (serveStaticFile(url.pathname, res)) {
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/destination") {
    const destination = url.searchParams.get("name");

    if (!destination) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Destination name is required" }));
      return;
    }

    if (!API_KEY) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "OpenTripMap API key is missing in .env" }));
      return;
    }

    try {
      // Step 1: Geocode destination using cities.json (fallback to Wikipedia)
      const coords = await getDestinationCoordinates(destination);

      if (!coords) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Destination "${destination}" not found` }));
        return;
      }

      // Step 2: Fetch famous tourist places with images in that area
      const places = await getNearbyPlaces(
        destination,
        coords.latitude,
        coords.longitude,
        30,
        coords.page
      );

      res.writeHead(200);
      res.end(
        JSON.stringify({
          destination: coords.title,
          country: coords.country || coords.title,
          source: coords.source,
          coordinates: { lat: coords.latitude, lon: coords.longitude },
          places: places,
        })
      );
    } catch (error) {
      console.error("OpenTripMap API error:", error);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Failed to fetch destination data" }));
    }

    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
