# Jadoo - Travel Agency Landing Page & Booking Platform

A modern, responsive, full-featured travel agency platform built with HTML5, CSS3, TypeScript, and Vanilla JavaScript. Features dynamic interactive components, client-side database engine matching custom ER schema, interactive Leaflet maps with real coordinates, review submission, booking status management with printable boarding passes, traveler profile dashboard, dark mode toggle, destination carousel, testimonials 3D stack, and mobile-friendly drawer navigation.

---

## 🌟 What's New & Advanced Features

### 1. Database Engine & Schema Implementation
Integrated client-side database layer in [`scripts/db.ts`](file:///c:/Users/Abcom/Desktop/task/scripts/db.ts) implementing the custom Draw.io ER Diagram:
- **`user`**: `id` (uuid), `full_name`, `email`, `password`, `created_at`, `logged_in_at`, `updated_at`.
- **`destinations`**: `name` (PK), `country`, `latitude`, `longitude`, `source`, `created_at`, `updated_at`.
- **`attraction`**: `name` (PK), `destination_name` (FK), `category`, `description`, `image_url`, `price_amount`, `rating`, `reviews_count`, `duration`, `wiki_url`, `point: {lat, lon}`, `created_at`, `updated_at`.
- **`booking`**: `id` (PK), `destination_name` (FK), `attraction_name` (FK), `user_name`, `user_email`, `phone_number`, `travel_date`, `guests_count`, `package_type` (`standard` | `VIP` | `luxury`), `price_per_person`, `total_price`, `special_request`, `status` (`pending` | `confirmed` | `cancelled`), `created_at`, `updated_at`.
- **`testimonial`**: `id` (PK), `user_id` (FK), `destination_name` (FK), `author_name`, `author_location`, `role_title`, `quote`, `rating`, `avatar_url`, `trip_tag`, `created_at`, `updated_at`.

### 2. Interactive Testimonial Submission Modal
- Direct CTA button **"Share Your Journey"** on the Testimonials section.
- Modal with interactive 5-star rating picker with real-time feedback, destination selector, avatar picker, and rich quotation feedback.
- Submitting automatically updates the `testimonial` database and live-injects the review into the 3D card carousel.

### 3. Boarding Pass & Printable Itinerary Modal
- Boarding pass design with flight route departure/arrival, passenger name, tour details, QR code, and barcode.
- One-click **"Print Boarding Pass"** action pre-configured with print-specific stylesheet (`@media print`) for high-resolution A4/Letter printouts.

### 4. Booking Status & Itinerary Management
- Enhanced **"My Bookings"** with status filter tabs:
  - **All**
  - **Confirmed** (Glowing Emerald)
  - **Pending** (Amber)
  - **Cancelled** (Crimson)
- Quick ticket access and trip cancellation actions.

### 5. Interactive Map & Category Explorer
- Open-source Leaflet.js interactive map with custom pins plotted using exact `latitude` and `longitude` coordinates from the schema.
- Interactive category filter chips: **Landmarks**, **Museums & Art**, **Architecture**, **Nature & Scenery**, and **Entertainment & Leisure**.
- Multi-view mode switcher: **Grid View**, **Map View**, and **Split View**.
- Works 100% offline and on static hosts like Netlify with automatic fallback.

### 6. Traveler Profile & Account Dashboard
- Dedicated profile modal displaying travel stats: Total Trips Booked, Active Journeys, and Total Amount Explored.
- Profile editing (Name, Phone number, and Avatar customization) synced across the navbar.

### 7. Floating Toast Notification Engine
- Non-intrusive alerts for bookings, reviews, profile updates, and cancellations.

---

## 📁 Project Structure

```
├── assets/                 # Images, icons, and illustrations
├── components/             # Sub-pages and modals
│   ├── auth.html           # Sign-in & Sign-up authentication page
│   └── destination-page.html # Search, filter, and interactive map exploration
├── styles/                 # Stylesheets
│   ├── styles.css          # Core design system and landing styles
│   ├── features.css        # New features (modals, tickets, maps, profile, toast)
│   ├── dark-theme.css      # Dark mode variables and transitions
│   ├── tablet.css          # Responsive tablet styles
│   ├── mobile.css          # Responsive mobile styles
│   └── auth.css            # Authentication form animations & styles
├── scripts/                # TypeScript & JavaScript logic
│   ├── db.ts / db.js       # Client-side Schema DB Engine & seed repository
│   ├── features.ts / js    # Controller for testimonials, tickets, status, profile
│   ├── destination.ts / js # Destination search, Leaflet map, category filters
│   ├── auth.ts / js        # Form validation and password strength meter
│   └── script.ts / js      # Landing page interactivity, themes, carousels
├── index.html              # Main landing page
└── server.ts / server.js   # Local Node.js server with OpenTripMap API proxy
```

---

## 🚀 Getting Started

### Local Development
```bash
# Typecheck TypeScript files
npm run typecheck

# Build TypeScript to JavaScript
npm run build

# Start local Node.js server
npm start
```

### Static / Netlify Deployment
The app is 100% compatible with static hosting (Netlify, GitHub Pages, Vercel). Simply upload or push the workspace directory.

Live at: `https://jadoowapp.netlify.app`