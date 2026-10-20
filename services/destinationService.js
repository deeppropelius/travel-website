import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Load cities.json dataset (around 130,000+ cities worldwide)
const citiesData = require("cities.json");
export const citiesList = citiesData;
// Famous country mapping for high-traffic cities with duplicate names across countries
export const famousCityCountryMap = {
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
export const WIKI_HEADERS = {
    "User-Agent": "JadooTravelApp/1.0 (https://jadoo-travel.example.com; contact@jadootravel.com) node-fetch",
};
// Check cities.json dataset first
export function getCityFromDataset(cityName) {
    const norm = cityName.trim().toLowerCase();
    const matches = citiesList.filter((c) => c.name.toLowerCase() === norm);
    if (matches.length === 0)
        return null;
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
// Search coordinates from Wikipedia
export async function getCoordinatesFromWiki(place) {
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
    if (!pages)
        return null;
    const page = Object.values(pages)[0];
    const coords = page.coordinates?.[0];
    if (!coords)
        return null;
    return {
        title: page.title,
        latitude: coords.lat,
        longitude: coords.lon,
        source: "wikipedia",
        page: page,
    };
}
// Master resolver: checks cities.json first, and if not found, falls back to Wikipedia
export async function getDestinationCoordinates(place) {
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
export function getPlaceTravelMeta(name, index) {
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
export async function getNearbyPlaces(destinationName, lat, lon, limit = 30, destPage) {
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
        fetch(wikiSearch, { headers: WIKI_HEADERS }).then((r) => r.ok ? r.json() : { query: { pages: {} } }),
        fetch(wikiGeo, { headers: WIKI_HEADERS }).then((r) => r.ok ? r.json() : { query: { pages: {} } }),
    ]);
    const searchPages = Object.values(searchRes.query?.pages || {});
    const geoPages = Object.values(geoRes.query?.pages || {});
    // Non-tourist filter to strictly remove non-sightseeing items
    const nonTourist = /(station|metro|railway|subway|airport|embassy|consulate|school|college|university|hospital|organisation|organization|company|bank|headquarters|police|depot|cemetery|barracks|library|institute|ministry|office|bureau|department|prison|court|prefecture|commune|massacre|bombing|battle|siege|ceremony|opening|revolution|disaster|fire|crash|attack|nightclub|brothel|treaty|syndrome|arrondissement|constituency|culture of|history of|demographics of|outline of|tourism in|lists of|timeline of|mayor of|politics of|economy of|geography of)/i;
    // Positive tourist keywords indicating iconic sights/landmarks
    const touristKeywords = /(tower|museum|palace|cathedral|basilica|church|temple|monument|statue|fountain|bridge|park|garden|square|plaza|theatre|theater|opera|château|castle|art|sculpture|gallery|landmark|attraction|aquarium|zoo|promenade|sanctuary|abbey|pyramid|colosseum|acropolis|amphitheatre|fort|fortress|island|resort|beach)/i;
    const combinedMap = new Map();
    // If the destination itself is an attraction (e.g. Ko Lamphu, Eiffel Tower, Central Park), include it first!
    if (destPage && destPage.thumbnail?.source) {
        combinedMap.set(destPage.title, {
            ...destPage,
            fameScore: 999999,
        });
    }
    const processPage = (p, fromSearch) => {
        if (!p.thumbnail?.source || p.title?.startsWith("List of "))
            return;
        const fullText = `${p.title} ${p.description || ""}`.toLowerCase();
        if (nonTourist.test(fullText))
            return;
        // Geographic verification if page has coordinates
        if (p.coordinates?.[0]) {
            const dLat = Math.abs(p.coordinates[0].lat - lat);
            const dLon = Math.abs(p.coordinates[0].lon - lon);
            // Skip if beyond ~60 km of the destination
            if (dLat > 0.6 || dLon > 0.6)
                return;
        }
        else if (fromSearch) {
            if (!fullText.includes(destinationName.toLowerCase()))
                return;
        }
        if (!combinedMap.has(p.title)) {
            let fameBonus = (fromSearch ? 100000 : 0) + (p.length || 0);
            if (touristKeywords.test(fullText))
                fameBonus += 50000;
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
        const description = cleanExtract || p.description || "A famous tourist landmark popular with travelers.";
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
/**
 * High-level service function to resolve coordinates and fetch tourist places for a given destination name.
 */
export async function fetchDestinationDetails(destinationName) {
    const coords = await getDestinationCoordinates(destinationName);
    if (!coords) {
        return null;
    }
    const places = await getNearbyPlaces(destinationName, coords.latitude, coords.longitude, 30, coords.page);
    return {
        destination: coords.title,
        country: coords.country || coords.title,
        source: coords.source,
        coordinates: { lat: coords.latitude, lon: coords.longitude },
        places: places,
    };
}
