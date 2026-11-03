import { JadooDB, DbAttraction, apiFetch } from "./db.js";
import { JadooNavAuth, JadooTheme } from "./features.js";

declare const L: any;

// Initialize theme & auth on destination page
if (typeof window !== "undefined") {
  JadooTheme.init();
  JadooNavAuth.init();
}

interface Place {
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
  city?: string;
  country?: string;
}

interface DestinationData {
  destination: string;
  country: string;
  coordinates: { lat: number; lon: number };
  places: Place[];
}

// Elements
const form = document.getElementById("destination-form") as HTMLFormElement | null;
const destInput = document.getElementById("search-destination") as HTMLInputElement | null;
const clearBtn = document.getElementById("clear-search") as HTMLButtonElement | null;
const resultsContainer = document.getElementById("results");
const toolbarEl = document.getElementById("results-toolbar");
const destTitle = document.getElementById("destination-title");
const countBadge = document.getElementById("places-count-badge");
const sortSelect = document.getElementById("sort-select") as HTMLSelectElement | null;
const paginationContainer = document.getElementById("pagination-container");
const prevPageBtn = document.getElementById("prev-page-btn") as HTMLButtonElement | null;
const nextPageBtn = document.getElementById("next-page-btn") as HTMLButtonElement | null;
const pageNumbersContainer = document.getElementById("page-numbers");
const quickChips = document.querySelectorAll<HTMLButtonElement>(".quick-chip");

// Sections for single-section view management
const popularLocationsSection = document.getElementById("popularLocationsSection");
const destinationResultsContainer = document.getElementById("destinationResultsContainer");
const btnBackToLocations = document.getElementById("btnBackToLocations");

// Featured Popular Location Cards
const locationCards = document.querySelectorAll<HTMLElement>(".location-card");

function showPopularLocationsView(): void {
  if (popularLocationsSection) popularLocationsSection.style.display = "block";
  if (destinationResultsContainer) destinationResultsContainer.style.display = "none";
  if (destInput) destInput.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  locationCards.forEach((c) => c.classList.remove("is-selected"));
  quickChips.forEach((c) => c.classList.remove("active"));
  try {
    const url = new URL(window.location.href);
    url.search = "";
    window.history.pushState({}, "", url.pathname);
  } catch (_) {}
  window.scrollTo({ top: 0, behavior: "smooth" });
}
(window as any).showPopularLocationsView = showPopularLocationsView;

function showAttractionsView(city: string): void {
  if (popularLocationsSection) popularLocationsSection.style.display = "none";
  if (destinationResultsContainer) destinationResultsContainer.style.display = "block";
  if (destInput) {
    destInput.value = city;
    if (clearBtn) clearBtn.style.display = "flex";
  }
  quickChips.forEach((c) => c.classList.toggle("active", c.getAttribute("data-city")?.toLowerCase() === city.toLowerCase()));
  locationCards.forEach((c) => c.classList.toggle("is-selected", c.getAttribute("data-city")?.toLowerCase() === city.toLowerCase()));
  getData(city);
  const targetScroll = destinationResultsContainer || toolbarEl;
  targetScroll?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Back to Popular Locations button
btnBackToLocations?.addEventListener("click", (e) => {
  e.preventDefault();
  showPopularLocationsView();
});

// Category Filter & View Mode Elements
const catChips = document.querySelectorAll<HTMLButtonElement>("#categoryFilterChips .cat-chip");
const viewSwitchBtns = document.querySelectorAll<HTMLButtonElement>("#viewModeSwitch .view-switch-btn");
const mapContainer = document.getElementById("destination-map");

// Modal elements
const modalOverlay = document.getElementById("place-modal-overlay");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalBgCover = document.getElementById("modal-bg-cover");
const modalBadge = document.getElementById("modal-badge");
const modalRating = document.getElementById("modal-rating");
const modalReviews = document.getElementById("modal-reviews");
const modalTitle = document.getElementById("modal-title");
const modalDestName = document.getElementById("modal-destination-name");
const modalDescription = document.getElementById("modal-description");
const modalDuration = document.getElementById("modal-duration");
const modalPrice = document.getElementById("modal-price");
const modalWikiLink = document.getElementById("modal-wiki-link") as HTMLAnchorElement | null;
const modalBookCta = document.getElementById("modal-book-cta");

let rawPlaces: Place[] = [];
let displayedPlaces: Place[] = [];
let currentDestination = "";
let currentPage = 1;
const ITEMS_PER_PAGE = 6;
let currentSort = "famous";
let currentCategory = "All";
let currentViewMode: "grid" | "map" | "split" = "grid";
let currentModalPlace: Place | null = null;
let leafletMap: any = null;
let mapMarkers: any[] = [];

// Input listeners
destInput?.addEventListener("input", () => {
  if (clearBtn) {
    clearBtn.style.display = destInput.value ? "flex" : "none";
  }
});

clearBtn?.addEventListener("click", () => {
  showPopularLocationsView();
});

// Quick trending chips
quickChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const city = chip.getAttribute("data-city");
    if (city) {
      showAttractionsView(city);
    }
  });
});

// Featured Popular Location Cards
locationCards.forEach((card) => {
  card.addEventListener("click", () => {
    const city = card.getAttribute("data-city");
    if (city) {
      showAttractionsView(city);
    }
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      card.click();
    }
  });
});

// Category Filter Chips
catChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    catChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    currentCategory = chip.getAttribute("data-category") || "All";
    applyCategoryAndSort();
    currentPage = 1;
    renderCurrentPage();
    updateMapMarkers();
  });
});

// View Mode Switcher
viewSwitchBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewSwitchBtns.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const mode = btn.getAttribute("data-view") as "grid" | "map" | "split";
    setViewMode(mode);
  });
});

function setViewMode(mode: "grid" | "map" | "split"): void {
  currentViewMode = mode;
  if (!mapContainer || !resultsContainer) return;

  if (mode === "grid") {
    mapContainer.style.display = "none";
    resultsContainer.style.display = "block";
    if (paginationContainer) paginationContainer.style.display = "flex";
  } else if (mode === "map") {
    mapContainer.style.display = "block";
    resultsContainer.style.display = "none";
    if (paginationContainer) paginationContainer.style.display = "none";
    initOrInvalidateMap();
  } else if (mode === "split") {
    mapContainer.style.display = "block";
    resultsContainer.style.display = "block";
    if (paginationContainer) paginationContainer.style.display = "flex";
    initOrInvalidateMap();
  }
}

// Form submit
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (destInput && destInput.value.trim()) {
    showAttractionsView(destInput.value.trim());
  }
});

// Sort select change
sortSelect?.addEventListener("change", () => {
  currentSort = sortSelect.value;
  applyCategoryAndSort();
  currentPage = 1;
  renderCurrentPage();
});

// Pagination event handlers
prevPageBtn?.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderCurrentPage();
    scrollToResults();
  }
});

nextPageBtn?.addEventListener("click", () => {
  const totalPages = Math.ceil(displayedPlaces.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderCurrentPage();
    scrollToResults();
  }
});

function scrollToResults() {
  toolbarEl?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Convert Schema DbAttraction to Place model
function convertDbAttractionToPlace(attraction: DbAttraction): Place {
  return {
    name: attraction.name,
    kinds: attraction.category,
    description: attraction.description,
    img: attraction.image_url,
    image: attraction.image_url,
    price: `$${attraction.price_amount}`,
    amount: attraction.price_amount,
    currency: "USD",
    rating: attraction.rating,
    reviews: attraction.reviews_count,
    badge: attraction.rating >= 4.9 ? "Top Rated" : "Popular",
    duration: attraction.duration,
    url: attraction.wiki_url,
    point: attraction.point
  };
}

// Fetch Destination Data with smart offline & JadooDB fallback
async function getData(destination: string) {
  const query = destination.trim();
  if (!query) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="empty-state">Please enter a destination name to start exploring.</div>`;
    }
    return;
  }

  if (popularLocationsSection) popularLocationsSection.style.display = "none";
  if (destinationResultsContainer) destinationResultsContainer.style.display = "block";

  renderSkeletons();
  if (toolbarEl) toolbarEl.style.display = "none";
  if (paginationContainer) paginationContainer.style.display = "none";

  let loadedPlaces: Place[] = [];
  let foundDestination = query;

  // 1. Fetch live attractions from backend API proxy (OpenTripMap + Wikipedia)
  try {
    const data = await apiFetch<DestinationData>(`/api/destination?name=${encodeURIComponent(query)}`);
    if (data && Array.isArray(data.places) && data.places.length > 0) {
      foundDestination = data.country ? `${data.destination}, ${data.country}` : data.destination;
      loadedPlaces = data.places;
    }
  } catch (err) {
    console.warn("Live destination API error:", err);
  }

  // 2. Fallback to PostgreSQL database attractions
  if (loadedPlaces.length === 0) {
    try {
      const attractions = await JadooDB.getAttractionsAsync(query);
      if (attractions && attractions.length > 0) {
        const dbDest = JadooDB.getDestination(query);
        foundDestination = dbDest ? `${dbDest.name}, ${dbDest.country}` : query;
        loadedPlaces = attractions.map(convertDbAttractionToPlace);
      }
    } catch (err) {
      console.warn("PostgreSQL attractions fetch error:", err);
    }
  }

  // 3. Fallback to cached/seed database
  if (loadedPlaces.length === 0) {
    const dbDest = JadooDB.getDestination(query);
    const dbAttractions = JadooDB.getAttractions(query);

    if (dbAttractions.length > 0) {
      foundDestination = dbDest ? `${dbDest.name}, ${dbDest.country}` : query;
      loadedPlaces = dbAttractions.map(convertDbAttractionToPlace);
    } else {
      const allAttractions = JadooDB.getAttractions();
      const matched = allAttractions.filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.destination_name.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
      );
      if (matched.length > 0) {
        foundDestination = query;
        loadedPlaces = matched.map(convertDbAttractionToPlace);
      }
    }
  }

  currentDestination = foundDestination;
  rawPlaces = loadedPlaces;

  if (rawPlaces.length === 0) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-map-location-dot"></i></div>
          <h3>No attractions found for "${escapeHTML(query)}"</h3>
          <p>Try searching for a major city like Paris, Tokyo, Rome, London, New York, or Dubai.</p>
        </div>
      `;
    }
    return;
  }

  // Update Toolbar Header
  if (destTitle) destTitle.textContent = `${currentDestination}`;
  if (countBadge) countBadge.textContent = `${rawPlaces.length} attractions`;
  if (toolbarEl) toolbarEl.style.display = "flex";

  // Sync selected state on Popular Location Cards
  locationCards.forEach((card) => {
    const cardCity = card.getAttribute("data-city")?.toLowerCase();
    const isMatch = Boolean(cardCity && (query.toLowerCase().includes(cardCity) || cardCity.includes(query.toLowerCase())));
    card.classList.toggle("is-selected", isMatch);
  });

  // Reset filters
  if (sortSelect) sortSelect.value = "famous";
  currentSort = "famous";
  currentCategory = "All";
  catChips.forEach(c => c.classList.toggle("is-active", (c.getAttribute("data-category") || "All") === "All"));

  applyCategoryAndSort();
  currentPage = 1;
  renderCurrentPage();
  updateMapMarkers();
}

const CATEGORY_RULES: Record<string, string[]> = {
  landmarks: [
    "landmark", "historic", "ancient", "monument", "temple", "ruin", "forum", "colosseum",
    "archaeolog", "wall", "fortificat", "gate", "tomb", "pyramid", "palace", "castle",
    "memorial", "heritage", "fountain", "square", "piazza", "step", "tower", "stair",
    "bath", "domus", "statue", "amphitheat", "basilica", "church"
  ],
  museums: [
    "museum", "art", "gallery", "exhibit", "collection", "fresco", "painting", "sculptur",
    "synagogue", "curated", "heritage"
  ],
  architecture: [
    "architect", "building", "cathedral", "basilica", "church", "temple", "palace",
    "tower", "bridge", "dome", "stairs", "amphitheat", "pyramid", "monument", "gate",
    "castle", "structure", "facade", "skyline"
  ],
  nature: [
    "nature", "park", "garden", "landscape", "hill", "mountain", "river", "lake",
    "beach", "island", "sea", "ocean", "waterfall", "zoo", "bioparco", "horti",
    "cliff", "scenic", "tree", "flora", "bay"
  ],
  entertainment: [
    "entertain", "leisure", "piazza", "square", "cafe", "caffè", "market", "shop",
    "theat", "opera", "nightlife", "zoo", "aquarium", "wheel", "cruise", "tour",
    "walk", "mask", "amusement", "dining", "resort"
  ]
};

function matchesCategory(place: Place, category: string): boolean {
  if (!category || category.toLowerCase() === "all") return true;
  const cat = category.toLowerCase().trim();

  const kindsLower = (place.kinds || "").toLowerCase();
  const descLower = (place.description || "").toLowerCase();
  const nameLower = (place.name || "").toLowerCase();
  const combinedText = `${nameLower} ${kindsLower} ${descLower}`;

  if (kindsLower.includes(cat) || descLower.includes(cat)) {
    return true;
  }

  let ruleKey = "";
  if (cat.includes("landmark") || cat.includes("historic")) ruleKey = "landmarks";
  else if (cat.includes("museum") || cat.includes("art")) ruleKey = "museums";
  else if (cat.includes("architect")) ruleKey = "architecture";
  else if (cat.includes("nature") || cat.includes("scener") || cat.includes("park")) ruleKey = "nature";
  else if (cat.includes("entertain") || cat.includes("leisure")) ruleKey = "entertainment";

  if (ruleKey && CATEGORY_RULES[ruleKey]) {
    return CATEGORY_RULES[ruleKey].some(kw => combinedText.includes(kw));
  }

  return combinedText.includes(cat);
}

// Apply Category Filter & Sorting
function applyCategoryAndSort() {
  displayedPlaces = [...rawPlaces];

  // Category Filter
  if (currentCategory && currentCategory !== "All") {
    displayedPlaces = displayedPlaces.filter(p => matchesCategory(p, currentCategory));
  }

  // Update Count Badge
  if (countBadge) {
    countBadge.textContent = `${displayedPlaces.length} attractions`;
  }

  // Sort
  switch (currentSort) {
    case "price-asc":
      displayedPlaces.sort((a, b) => a.amount - b.amount);
      break;
    case "price-desc":
      displayedPlaces.sort((a, b) => b.amount - a.amount);
      break;
    case "rating-desc":
      displayedPlaces.sort((a, b) => b.rating - a.rating);
      break;
    case "reviews-desc":
      displayedPlaces.sort((a, b) => b.reviews - a.reviews);
      break;
    case "famous":
    default:
      break;
  }
}

// Render Current Page
function renderCurrentPage() {
  if (!resultsContainer) return;

  const totalPages = Math.ceil(displayedPlaces.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pagePlaces = displayedPlaces.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  resultsContainer.innerHTML = "";

  if (pagePlaces.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-filter"></i></div>
        <h3>No attractions in "${currentCategory}"</h3>
        <p>Try switching categories or view all attractions for this destination.</p>
      </div>
    `;
    updatePagination(0);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "places-grid";

  pagePlaces.forEach((place, index) => {
    const card = createPlaceCard(place, index);
    grid.appendChild(card);
  });

  resultsContainer.appendChild(grid);
  updatePagination(totalPages);
}

// Create an animated Place Card
function createPlaceCard(place: Place, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "place-card animate-in";
  card.style.animationDelay = `${index * 0.08}s`;

  // Image wrapper
  const imageWrap = document.createElement("div");
  imageWrap.className = "place-card-img-wrap";

  const imgSrc = place.img || place.image || place.preview?.source;
  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = place.name;
    img.className = "place-img";
    img.loading = "lazy";
    imageWrap.appendChild(img);
  }

  if (place.badge) {
    const badge = document.createElement("span");
    badge.className = "place-badge";
    badge.textContent = place.badge;
    imageWrap.appendChild(badge);
  }

  card.appendChild(imageWrap);

  // Card Body
  const body = document.createElement("div");
  body.className = "place-card-body";

  const ratingRow = document.createElement("div");
  ratingRow.className = "place-rating-row";
  ratingRow.innerHTML = `
    <span class="place-rating"><i class="fa-solid fa-star"></i> ${place.rating.toFixed(1)}</span>
    <span class="place-reviews">(${place.reviews.toLocaleString()} reviews)</span>
    ${place.duration ? `<span class="place-duration">• ${place.duration}</span>` : ""}
  `;
  body.appendChild(ratingRow);

  const title = document.createElement("h3");
  title.className = "place-title";
  title.textContent = place.name;
  body.appendChild(title);

  // Location Card Badge
  const locationTag = document.createElement("div");
  locationTag.className = "place-card-location";
  const displayCity = place.city || currentDestination.split(',')[0].trim() || 'Popular City';
  const displayCountry = place.country || (currentDestination.includes(',') ? currentDestination.split(',')[1].trim() : 'Destination');
  locationTag.innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>${escapeHTML(displayCity)}, ${escapeHTML(displayCountry)}</span>`;
  body.appendChild(locationTag);

  const descText = place.description || place.kinds;
  if (descText) {
    const desc = document.createElement("p");
    desc.className = "place-description";
    desc.textContent = descText;
    body.appendChild(desc);
  }

  const footer = document.createElement("div");
  footer.className = "place-card-footer";
  footer.innerHTML = `
    <div class="place-price-wrap">
      <span class="place-price-label">Ticket / Tour</span>
      <span class="place-price">${place.price || `$${place.amount}`}</span>
      <span class="place-price-unit">per person</span>
    </div>
    <div class="place-card-btns">
      <button class="place-view-btn" type="button" aria-label="View details for ${place.name}">
        <span>Details</span>
      </button>
      <button class="place-book-btn" type="button" aria-label="Book ${place.name}">
        <span>Book</span>
      </button>
    </div>
  `;
  body.appendChild(footer);
  card.appendChild(body);

  const bookBtn = footer.querySelector<HTMLButtonElement>(".place-book-btn");
  bookBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openBookingModalForPlace(place);
  });

  const viewBtn = footer.querySelector<HTMLButtonElement>(".place-view-btn");
  viewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPlaceModal(place);
  });

  card.style.cursor = "pointer";
  card.addEventListener("click", () => {
    openPlaceModal(place);
  });

  return card;
}

function openBookingModalForPlace(place: Place): void {
  const currentUser = (window as any).JadooDB?.getCurrentUser() || (window as any).JadooAuth?.getCurrentUser();
  if (!currentUser) {
    const proceed = confirm("You must be logged in to book a trip or ticket.\n\nClick OK to Sign In or Create an Account.");
    if (proceed) {
      window.location.href = "auth.html#signin";
    }
    return;
  }

  const jadooUI = (window as any).JadooUI;
  const placePrice = place.amount || (typeof place.price === "string" ? parseFloat(place.price.replace(/[^0-9.]/g, "")) : 55) || 55;
  const imgSrc = place.img || place.image || place.preview?.source || "./assets/destination-rome.png";

  if (jadooUI && typeof jadooUI.openBookingModal === "function") {
    jadooUI.openBookingModal({
      placeName: place.name,
      destination: currentDestination || "Destination",
      price: placePrice,
      image: imgSrc
    });
  }
}

// ── CITY COORDINATES & LEAFLET INTERACTIVE MAP INTEGRATION ──────────
const CITY_COORDINATES: Record<string, [number, number]> = {
  rome: [41.8902, 12.4922],
  london: [51.5074, -0.1278],
  paris: [48.8566, 2.3522],
  tokyo: [35.6762, 139.6503],
  "new york": [40.7128, -74.006],
  dubai: [25.2048, 55.2708],
  sydney: [-33.8688, 151.2093],
  agra: [27.1767, 78.0081],
  bali: [-8.3405, 115.092],
  santorini: [36.3932, 25.4615],
  venice: [45.4408, 12.3155]
};

function resolveCityCoordinates(cityName: string): [number, number] {
  const norm = (cityName || "").toLowerCase().trim();
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return coords;
    }
  }
  return [41.8902, 12.4922];
}

function extractPoint(p: Place, fallbackCity?: string): { lat: number; lon: number } | null {
  if (!p) return null;
  let pt: any = p.point;
  if (typeof pt === "string") {
    try { pt = JSON.parse(pt); } catch (_) { pt = null; }
  }
  if (pt && typeof pt === "object") {
    const lat = parseFloat(pt.lat ?? pt.latitude);
    const lon = parseFloat(pt.lon ?? pt.lng ?? pt.longitude);
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      return { lat, lon };
    }
  }
  const cityKey = (p.city || fallbackCity || currentDestination || "").toLowerCase();
  const baseCoords = resolveCityCoordinates(cityKey);
  if (baseCoords) {
    const seed = (p.name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const jitterLat = (((seed % 80) - 40) / 1000) * 0.2;
    const jitterLon = ((((seed * 13) % 80) - 40) / 1000) * 0.2;
    return { lat: baseCoords[0] + jitterLat, lon: baseCoords[1] + jitterLon };
  }
  return null;
}

function initOrInvalidateMap(): void {
  if (typeof L === "undefined" || !mapContainer) return;

  const targetCoords = resolveCityCoordinates(currentDestination);

  if (!leafletMap) {
    leafletMap = L.map("destination-map", {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView(targetCoords, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(leafletMap);
  } else {
    leafletMap.setView(targetCoords, 12);
  }

  setTimeout(() => {
    leafletMap.invalidateSize();
    updateMapMarkers();
  }, 200);
}

function updateMapMarkers(): void {
  if (typeof L === "undefined" || !leafletMap) return;

  mapMarkers.forEach((m) => leafletMap.removeLayer(m));
  mapMarkers = [];

  const targetCityCoords = resolveCityCoordinates(currentDestination);

  const placesWithCoords: { place: Place; lat: number; lon: number }[] = [];
  displayedPlaces.forEach((p) => {
    const pt = extractPoint(p, currentDestination);
    if (pt) {
      placesWithCoords.push({ place: p, lat: pt.lat, lon: pt.lon });
    }
  });

  if (placesWithCoords.length === 0) {
    leafletMap.setView(targetCityCoords, 12);
    return;
  }

  const latLngs: any[] = [];

  placesWithCoords.forEach(({ place: p, lat, lon }) => {
    latLngs.push([lat, lon]);

    const imgSrc = p.img || p.image || p.preview?.source || "./assets/destination-rome.png";

    const popupHtml = `
      <div class="map-popup-card">
        <img src="${imgSrc}" alt="${escapeHTML(p.name)}" class="map-popup-img">
        <div class="map-popup-body">
          <h4 class="map-popup-title">${escapeHTML(p.name)}</h4>
          <span style="font-size: 0.75rem; color: #64748B;"><i class="fa-solid fa-star" style="color: #F1A501;"></i> ${p.rating.toFixed(1)} (${p.reviews} reviews)</span>
          <div class="map-popup-price-row">
            <span class="map-popup-price">${p.price || `${p.amount}`}</span>
            <button type="button" class="map-popup-btn" id="mapBookBtn-${escapeHTML(p.name).replace(/\s+/g, '_')}">Book Now</button>
          </div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: "custom-map-pin",
      html: `
        <div style="background: #DF6951; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(223, 105, 81, 0.45); border: 2px solid #FFF;">
          <i class="fa-solid fa-location-dot" style="transform: rotate(45deg); color: #FFF; font-size: 14px;"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const marker = L.marker([lat, lon], { icon: customIcon }).bindPopup(popupHtml).addTo(leafletMap);

    marker.on("popupopen", () => {
      const btnId = `mapBookBtn-${escapeHTML(p.name).replace(/\s+/g, "_")}`;
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          openBookingModalForPlace(p);
        });
      }
    });

    mapMarkers.push(marker);
  });

  if (latLngs.length > 0) {
    try {
      leafletMap.fitBounds(latLngs, { padding: [50, 50], maxZoom: 15 });
    } catch {
      leafletMap.setView(targetCityCoords, 12);
    }
  } else {
    leafletMap.setView(targetCityCoords, 12);
  }
}

// Update Pagination
function updatePagination(totalPages: number) {
  if (!paginationContainer || !pageNumbersContainer || !prevPageBtn || !nextPageBtn) return;

  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = currentViewMode === "map" ? "none" : "flex";
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;

  pageNumbersContainer.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const numBtn = document.createElement("button");
    numBtn.type = "button";
    numBtn.className = `page-btn page-num-btn ${i === currentPage ? "active" : ""}`;
    numBtn.textContent = i.toString();
    numBtn.addEventListener("click", () => {
      currentPage = i;
      renderCurrentPage();
      scrollToResults();
    });
    pageNumbersContainer.appendChild(numBtn);
  }
}

// Render skeleton loaders for rich loading effect
function renderSkeletons() {
  if (!resultsContainer) return;
  resultsContainer.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "places-grid";

  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "place-card skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton-img skeleton-pulse"></div>
      <div class="place-card-body">
        <div class="skeleton-line skeleton-short skeleton-pulse"></div>
        <div class="skeleton-line skeleton-title skeleton-pulse"></div>
        <div class="skeleton-line skeleton-text skeleton-pulse"></div>
        <div class="skeleton-line skeleton-text skeleton-pulse"></div>
        <div class="skeleton-footer">
          <div class="skeleton-line skeleton-price skeleton-pulse"></div>
          <div class="skeleton-line skeleton-btn skeleton-pulse"></div>
        </div>
      </div>
    `;
    grid.appendChild(skeleton);
  }

  resultsContainer.appendChild(grid);
}

// Open Landmark Details Modal
function openPlaceModal(place: Place) {
  currentModalPlace = place;
  if (!modalOverlay) return;

  const imgSrc = place.img || place.image || place.preview?.source;
  if (modalBgCover && imgSrc) {
    modalBgCover.style.backgroundImage = `url('${imgSrc}')`;
  }
  if (modalBadge) modalBadge.textContent = place.badge || "Featured Landmark";
  if (modalRating) modalRating.textContent = place.rating.toFixed(1);
  if (modalReviews) modalReviews.textContent = `(${place.reviews.toLocaleString()} reviews)`;
  if (modalTitle) modalTitle.textContent = place.name;
  if (modalDestName) modalDestName.textContent = currentDestination || "Destination";
  if (modalDescription) modalDescription.textContent = place.description || place.kinds || "Experience world-renowned architectural majesty and cultural heritage.";
  if (modalDuration) modalDuration.textContent = place.duration || "2-3 Hours";
  if (modalPrice) modalPrice.textContent = place.price || `$${place.amount}`;

  if (modalWikiLink) {
    if (place.url) {
      modalWikiLink.href = place.url;
      modalWikiLink.style.display = "inline-flex";
    } else {
      modalWikiLink.style.display = "none";
    }
  }

  // Sync wishlist button in modal
  const btnToggleWishlist = document.getElementById("btnToggleWishlistLandmark");
  const btnToggleWishlistText = document.getElementById("btnToggleWishlistLandmarkText");
  const btnToggleWishlistIcon = btnToggleWishlist?.querySelector("i");
  if (btnToggleWishlistText && btnToggleWishlistIcon) {
    let saved: any[] = [];
    try {
      saved = JSON.parse(localStorage.getItem("jadoo_saved_wishlist") || "[]");
    } catch (_) { saved = []; }
    const placeId = `place-${place.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const isSaved = saved.some((item: any) => item.title === place.name || item.id === placeId);
    if (isSaved) {
      btnToggleWishlistText.textContent = "Saved in Wishlist";
      btnToggleWishlistIcon.className = "fa-solid fa-heart";
      if (btnToggleWishlist) {
        btnToggleWishlist.style.background = "rgba(239, 68, 68, 0.12)";
        btnToggleWishlist.style.color = "#EF4444";
        btnToggleWishlist.style.borderColor = "rgba(239, 68, 68, 0.35)";
        btnToggleWishlist.title = "Click to remove from your Saved Wishlist";
      }
    } else {
      btnToggleWishlistText.textContent = "Save to Wishlist";
      btnToggleWishlistIcon.className = "fa-regular fa-heart";
      if (btnToggleWishlist) {
        btnToggleWishlist.style.background = "rgba(241, 165, 1, 0.12)";
        btnToggleWishlist.style.color = "#D97706";
        btnToggleWishlist.style.borderColor = "rgba(241, 165, 1, 0.35)";
        btnToggleWishlist.title = "Save this destination to your Wishlist";
      }
    }
  }

  modalOverlay.classList.add("active");
  modalOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePlaceModal() {
  if (!modalOverlay) return;
  if (typeof document !== 'undefined' && document.activeElement && modalOverlay.contains(document.activeElement)) {
    (document.activeElement as HTMLElement).blur();
  }
  modalOverlay.classList.remove("active");
  modalOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

modalCloseBtn?.addEventListener("click", closePlaceModal);
modalOverlay?.querySelector(".place-modal-backdrop")?.addEventListener("click", closePlaceModal);

modalBookCta?.addEventListener("click", () => {
  if (currentModalPlace) {
    closePlaceModal();
    openBookingModalForPlace(currentModalPlace);
  }
});

const btnShareLandmarkReview = document.getElementById("btnShareLandmarkReview");
btnShareLandmarkReview?.addEventListener("click", () => {
  const currentDest = currentDestination;
  const currentPlace = currentModalPlace;
  closePlaceModal();
  if (typeof (window as any).JadooReviewModal !== 'undefined' && (window as any).JadooReviewModal.open) {
    (window as any).JadooReviewModal.open();
    const destSelect = document.getElementById("reviewDestinationSelect") as HTMLSelectElement | null;
    const tagInput = document.getElementById("reviewTripTag") as HTMLInputElement | null;
    if (destSelect && currentDest) destSelect.value = currentDest;
    if (tagInput && currentPlace) tagInput.value = `${currentPlace.name} Tour`;
  }
});

const btnToggleWishlistLandmark = document.getElementById("btnToggleWishlistLandmark");
btnToggleWishlistLandmark?.addEventListener("click", () => {
  if (!currentModalPlace) return;
  const place = currentModalPlace;
  let saved: any[] = [];
  try {
    saved = JSON.parse(localStorage.getItem("jadoo_saved_wishlist") || "[]");
  } catch (_) { saved = []; }

  const placeId = `place-${place.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const existingIdx = saved.findIndex((item: any) => item.title === place.name || item.id === placeId);

  if (existingIdx >= 0) {
    if (!confirm(`Are you sure you want to remove "${place.name}" from your saved destinations?`)) {
      return;
    }
    saved.splice(existingIdx, 1);
    try { localStorage.setItem("jadoo_saved_wishlist", JSON.stringify(saved)); } catch (_) {}
    if (typeof (window as any).JadooToast !== "undefined") {
      (window as any).JadooToast.show("Removed from Saved", `"${place.name}" was removed from your wishlist.`, "info");
    }
  } else {
    const imgSrc = place.img || place.image || place.preview?.source || "../assets/destination-rome.png";
    const newItem = {
      id: placeId,
      title: place.name,
      description: place.description || place.kinds || "Curated landmark tour and cultural expedition.",
      img: imgSrc,
      rating: place.rating ? place.rating.toFixed(1) : "4.9",
      reviews: place.reviews ? place.reviews.toLocaleString() : "1,500",
      price: place.price || `${place.amount || 55} / person`,
      actionUrl: `./destination-page.html?search=${encodeURIComponent(currentDestination || place.name)}`,
      actionLabel: "Explore",
      actionType: "secondary"
    };
    saved.unshift(newItem);
    try { localStorage.setItem("jadoo_saved_wishlist", JSON.stringify(saved)); } catch (_) {}
    if (typeof (window as any).JadooToast !== "undefined") {
      (window as any).JadooToast.show("Saved to Wishlist", `"${place.name}" has been saved to your wishlist!`, "success");
    }
  }

  // Refresh button state in modal
  const btnText = document.getElementById("btnToggleWishlistLandmarkText");
  const btnIcon = btnToggleWishlistLandmark?.querySelector("i");
  const isSavedNow = saved.some((item: any) => item.title === place.name || item.id === placeId);
  if (btnText && btnIcon && btnToggleWishlistLandmark) {
    if (isSavedNow) {
      btnText.textContent = "Saved in Wishlist";
      btnIcon.className = "fa-solid fa-heart";
      btnToggleWishlistLandmark.style.background = "rgba(239, 68, 68, 0.12)";
      btnToggleWishlistLandmark.style.color = "#EF4444";
      btnToggleWishlistLandmark.style.borderColor = "rgba(239, 68, 68, 0.35)";
      btnToggleWishlistLandmark.title = "Click to remove from your Saved Wishlist";
    } else {
      btnText.textContent = "Save to Wishlist";
      btnIcon.className = "fa-regular fa-heart";
      btnToggleWishlistLandmark.style.background = "rgba(241, 165, 1, 0.12)";
      btnToggleWishlistLandmark.style.color = "#D97706";
      btnToggleWishlistLandmark.style.borderColor = "rgba(241, 165, 1, 0.35)";
      btnToggleWishlistLandmark.title = "Save this destination to your Wishlist";
    }
  }
});

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize on page load: check URL parameters or show Popular Locations view
const urlParams = new URLSearchParams(window.location.search);
const queryParam = urlParams.get("search") || urlParams.get("city") || urlParams.get("destination");
if (queryParam && queryParam.trim()) {
  showAttractionsView(queryParam.trim());
} else {
  showPopularLocationsView();
}
