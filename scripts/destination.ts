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
let currentModalPlace: Place | null = null;

// Input listeners
destInput?.addEventListener("input", () => {
  if (clearBtn) {
    clearBtn.style.display = destInput.value ? "flex" : "none";
  }
});

clearBtn?.addEventListener("click", () => {
  if (destInput) {
    destInput.value = "";
    destInput.focus();
  }
  if (clearBtn) clearBtn.style.display = "none";
});

// Quick trending chips
quickChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const city = chip.getAttribute("data-city");
    if (city && destInput) {
      destInput.value = city;
      if (clearBtn) clearBtn.style.display = "flex";
      // Highlight active chip
      quickChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      getData(city);
    }
  });
});

// Form submit
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (destInput && destInput.value.trim()) {
    getData(destInput.value.trim());
  }
});

// Sort select change
sortSelect?.addEventListener("change", () => {
  currentSort = sortSelect.value;
  applySorting();
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

// Fetch Destination Data
async function getData(destination: string) {
  const query = destination.trim();
  if (!query) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="empty-state">Please enter a destination name to start exploring.</div>`;
    }
    return;
  }

  // Render Skeleton Placeholders for smooth UI feel
  renderSkeletons();
  if (toolbarEl) toolbarEl.style.display = "none";
  if (paginationContainer) paginationContainer.style.display = "none";

  try {
    const params = new URLSearchParams({
      name: query,
    });

    const response = await fetch(`http://localhost:3000/api/destination?${params}`);
    const data: DestinationData = await response.json();

    if (!response.ok) {
      throw new Error((data as any).error ?? "Request failed");
    }

    currentDestination = data.destination;
    rawPlaces = data.places || [];

    if (rawPlaces.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-map-location-dot"></i></div>
            <h3>No attractions found for "${query}"</h3>
            <p>Try searching for a major city, landmark, or region like Paris, Tokyo, Rome, or Dubai.</p>
          </div>
        `;
      }
      return;
    }

    // Update Toolbar Header
    if (destTitle) destTitle.textContent = `${data.destination}`;
    if (countBadge) countBadge.textContent = `${rawPlaces.length} attractions`;
    if (toolbarEl) toolbarEl.style.display = "flex";

    // Reset sort and page
    if (sortSelect) sortSelect.value = "famous";
    currentSort = "famous";
    applySorting();
    currentPage = 1;

    renderCurrentPage();
  } catch (error: any) {
    console.error("Error fetching destination:", error);
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="error-state">
          <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h3>Unable to fetch attractions</h3>
          <p>${
            error.message === "Failed to fetch"
              ? "Cannot connect to server. Ensure `npm start` is running on port 3000."
              : error.message || "An error occurred."
          }</p>
        </div>
      `;
    }
  }
}

// Apply Selected Sorting
function applySorting() {
  displayedPlaces = [...rawPlaces];

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
      // Preserves default curated fame ranking from API
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

  // Rating & review row
  const ratingRow = document.createElement("div");
  ratingRow.className = "place-rating-row";
  ratingRow.innerHTML = `
    <span class="place-rating"><i class="fa-solid fa-star"></i> ${place.rating.toFixed(1)}</span>
    <span class="place-reviews">(${place.reviews.toLocaleString()} reviews)</span>
    ${place.duration ? `<span class="place-duration">• ${place.duration}</span>` : ""}
  `;
  body.appendChild(ratingRow);

  // Title
  const title = document.createElement("h3");
  title.className = "place-title";
  title.textContent = place.name;
  body.appendChild(title);

  // Description
  const descText = place.description || place.kinds;
  if (descText) {
    const desc = document.createElement("p");
    desc.className = "place-description";
    desc.textContent = descText;
    body.appendChild(desc);
  }

  // Card Footer with Price and Book Button
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

  // Book button click -> open interactive booking modal
  const bookBtn = footer.querySelector<HTMLButtonElement>(".place-book-btn");
  bookBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const jadooUI = (window as any).JadooUI;
    const placePrice = place.amount || (typeof place.price === "string" ? parseFloat(place.price.replace(/[^0-9.]/g, "")) : 120) || 120;
    if (jadooUI && typeof jadooUI.openBookingModal === "function") {
      jadooUI.openBookingModal({
        placeName: place.name,
        destination: currentDestination || "Destination",
        price: placePrice,
        image: imgSrc || ""
      });
    } else {
      bookBtn.classList.add("booked");
      bookBtn.innerHTML = `<span><i class="fa-solid fa-check"></i> Added</span>`;
      setTimeout(() => {
        bookBtn.classList.remove("booked");
        bookBtn.innerHTML = `<span>Book</span>`;
      }, 1800);
    }
  });

  const viewBtn = footer.querySelector<HTMLButtonElement>(".place-view-btn");
  viewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPlaceModal(place);
  });

  // Clicking anywhere on the card opens the full-screen details modal
  card.style.cursor = "pointer";
  card.addEventListener("click", () => {
    openPlaceModal(place);
  });

  card.appendChild(body);
  return card;
}

// Open Place Details Modal with Background Image & Foreground Content
function openPlaceModal(place: Place) {
  if (!modalOverlay) return;
  currentModalPlace = place;

  const imgSrc = place.img || place.image || place.preview?.source;
  if (modalBgCover) {
    if (imgSrc) {
      modalBgCover.style.backgroundImage = `url("${imgSrc}")`;
    } else {
      modalBgCover.style.backgroundImage = "none";
      modalBgCover.style.backgroundColor = "#181E4B";
    }
  }

  if (modalBadge) {
    modalBadge.textContent = place.badge || "Featured Landmark";
  }

  if (modalRating) {
    modalRating.textContent = place.rating.toFixed(1);
  }

  if (modalReviews) {
    modalReviews.textContent = `(${place.reviews.toLocaleString()} reviews)`;
  }

  if (modalTitle) {
    modalTitle.textContent = place.name;
  }

  if (modalDestName) {
    modalDestName.textContent = currentDestination || "Popular Destination";
  }

  if (modalDescription) {
    modalDescription.textContent =
      place.description || place.kinds || "A world-renowned tourist attraction offering memorable sights and experiences.";
  }

  if (modalDuration) {
    modalDuration.textContent = place.duration || "2-3 Hours";
  }

  if (modalPrice) {
    modalPrice.textContent = place.price || `$${place.amount}`;
  }

  if (modalWikiLink) {
    if (place.url) {
      modalWikiLink.href = place.url;
      modalWikiLink.style.display = "inline-flex";
    } else {
      modalWikiLink.style.display = "none";
    }
  }

  // Open modal animation
  modalOverlay.classList.add("active");
  modalOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

// Close Modal Function
function closePlaceModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove("active");
  modalOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// Modal Event Listeners
modalCloseBtn?.addEventListener("click", closePlaceModal);

modalOverlay?.addEventListener("click", (e) => {
  if (e.target === modalOverlay || (e.target as HTMLElement).classList.contains("place-modal-backdrop")) {
    closePlaceModal();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay?.classList.contains("active")) {
    closePlaceModal();
  }
});

modalBookCta?.addEventListener("click", () => {
  if (currentModalPlace) {
    const place = currentModalPlace;
    closePlaceModal();
    const jadooUI = (window as any).JadooUI;
    const imgSrc = place.img || place.image || place.preview?.source || "";
    const placePrice = place.amount || (typeof place.price === "string" ? parseFloat(place.price.replace(/[^0-9.]/g, "")) : 120) || 120;
    if (jadooUI && typeof jadooUI.openBookingModal === "function") {
      jadooUI.openBookingModal({
        placeName: place.name,
        destination: currentDestination || "Destination",
        price: placePrice,
        image: imgSrc
      });
    }
  } else if (modalBookCta) {
    modalBookCta.classList.add("booked");
    modalBookCta.innerHTML = `<span><i class="fa-solid fa-circle-check"></i> Tickets Confirmed!</span>`;
    setTimeout(() => {
      modalBookCta.classList.remove("booked");
      modalBookCta.innerHTML = `<span>Book Tickets Now</span>`;
    }, 2000);
  }
});

// Update Pagination Numbers and Navigation
function updatePagination(totalPages: number) {
  if (!paginationContainer || !pageNumbersContainer) return;

  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";
  pageNumbersContainer.innerHTML = "";

  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

  for (let i = 1; i <= totalPages; i++) {
    const numBtn = document.createElement("button");
    numBtn.type = "button";
    numBtn.className = `page-num-btn ${i === currentPage ? "active" : ""}`;
    numBtn.textContent = i.toString();
    numBtn.setAttribute("aria-label", `Go to page ${i}`);
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

// Initialize on page load with default search
getData("Paris");

