/**
 * Jadoo Travel Agency – API Client (PostgreSQL Backend)
 *
 * Replaces the old localStorage engine (JadooDB / JadooDatabase).
 * All reads/writes now go through the Express API server at http://localhost:3000.
 *
 * Public API is 100% backwards-compatible with the old localStorage API so
 * existing scripts/features.ts code requires minimal changes.
 */

// ── Base URL (dynamically resolves to active host/port or fallback)
export function getApiBase(): string {
    if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;

        // If served as a file:// URL, backend is always on localhost:3000
        if (protocol === 'file:') return 'http://localhost:3000';

        // If already on port 3000 (Express serves HTML directly), use same origin
        if (port === '3000') return window.location.origin;

        // Any other port means a static dev server (Live Server 5500-5510, Vite 5173, etc.)
        // Backend is always on port 3000 of the same hostname
        if (port && port !== '' && port !== '80' && port !== '443') {
            return `http://${hostname}:3000`;
        }

        // Standard HTTP/HTTPS (production or reverse-proxy) — use origin
        if (protocol === 'http:' || protocol === 'https:') {
            return window.location.origin;
        }
    }
    return 'http://localhost:3000';
}

export const API_BASE = getApiBase();

// ═══════════════════════════════════════════════════════════════
// TYPES  (unchanged from before)
// ═══════════════════════════════════════════════════════════════
export interface DbCustomer {
    id: string;
    created_at: string;
    updated_at: string;
    full_name: string;
    email: string;
    password?: string;
    phone?: string;
    avatar_url?: string;
    logged_in_at?: string;
    token?: string;
}
export type DbUser = DbCustomer;
export type Customer = DbCustomer;

export interface DbDestination {
    id: string;
    created_at: string;
    updated_at: string;
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    source?: string;
    hero_img?: string;
    description?: string;
}
export type Destination = DbDestination;

export interface DbAttraction {
    id: string;
    name: string;
    destination_name: string;
    category: 'Historical Landmark' | 'Museum & Art' | 'Architecture' | 'Nature & Scenery' | 'Entertainment & Leisure';
    description: string;
    image_url: string;
    price_amount: number;
    rating: number;
    reviews_count: number;
    duration: string;
    wiki_url: string;
    point: { lat: number; lon: number };
    created_at: string;
    updated_at: string;
}

export type DbPackageType = 'standard' | 'VIP' | 'luxury';
export type DbBookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface DbBooking {
    id: string;
    booking_ref?: string;
    created_at: string;
    updated_at: string;
    customer_id: string;
    destination_id: string;
    destination_name: string;
    attraction_name: string;
    user_name: string;
    user_email: string;
    phone_number: string;
    travel_date: string;
    guests_count: number;
    package_type: DbPackageType;
    price_per_person: number;
    total_price: number;
    special_request: string;
    status: DbBookingStatus;
    image_url?: string;
}
export type Booking = DbBooking;

export interface DbTestimonial {
    id: string;
    created_at: string;
    updated_at: string;
    costumer_id?: string;
    customer_id?: string;
    destination_id?: string;
    user_id?: string;
    author_email?: string;
    destination_name: string;
    author_name: string;
    author_location: string;
    role_title: string;
    quote: string;
    rating: number;
    avatar_url: string;
    trip_tag: string;
}
export type Testimonials = DbTestimonial;

export interface DbTravelService {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    category: string;
    icon: string;
    badge: string;
    short_desc: string;
    description: string;
    features: string[];
    starting_price: string;
    unit: string;
    rating: number;
    reviews_count: number;
    included_perks: string[];
    banner_image: string;
}

export interface DbServiceInquiry {
    id?: string;
    service_id: string;
    service_title: string;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    travel_destination?: string;
    travel_date?: string;
    message?: string;
    status?: string;
    created_at?: string;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function getStoredAuthToken(): string | null {
    if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('jadoo_auth_token');
        if (local) return local;
    }
    if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )jadoo_auth_token=([^;]*)/);
        if (match) {
            try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
        }
    }
    return null;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const primaryBase = getApiBase();
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options?.headers as Record<string, string>) || {})
    };
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
        ...options,
        headers
    };

    try {
        const res = await fetch(`${primaryBase}${path}`, fetchOptions);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (err: any) {
        // Fallback retry: if on 3000 try 3001; if on 3001 try 3000
        if (primaryBase.includes(':3000') || primaryBase.includes(':3001')) {
            const fallbackBase = primaryBase.includes(':3000')
                ? primaryBase.replace(':3000', ':3001')
                : primaryBase.replace(':3001', ':3000');
            try {
                const res = await fetch(`${fallbackBase}${path}`, fetchOptions);
                if (res.ok) {
                    return await res.json();
                }
            } catch (_) {}
        }
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════
// SESSION  (still stored in localStorage for browser persistence)
// ═══════════════════════════════════════════════════════════════
function getIsComponent(): boolean {
    return typeof window !== 'undefined' && window.location.pathname.includes('/components/');
}

function defaultAvatar(): string {
    return getIsComponent() ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png';
}

function normalizeAvatar(avatar: string | undefined): string {
    const isComp = getIsComponent();
    const av = avatar || defaultAvatar();
    if (isComp && av.startsWith('./assets/')) return '.' + av;
    if (!isComp && av.startsWith('../assets/')) return av.replace(/^\.\.\//, './');
    return av;
}

// ═══════════════════════════════════════════════════════════════
// SEED FALLBACK DATA
// ═══════════════════════════════════════════════════════════════
const SEED_DESTINATIONS: DbDestination[] = [
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01',
        name: 'Rome',
        country: 'Italy',
        latitude: 41.8902,
        longitude: 12.4922,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-rome.png',
        description: 'The Eternal City with thousands of years of ancient history, magnificent fountains, and world-renowned gastronomy.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02',
        name: 'London',
        country: 'United Kingdom',
        latitude: 51.5074,
        longitude: -0.1278,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-london.jpeg',
        description: 'Vibrant cosmopolitan metropolis with iconic royal landmarks, world-class theaters, and the Thames riverfront.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e03',
        name: 'Paris',
        country: 'France',
        latitude: 48.8566,
        longitude: 2.3522,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-paris.jpg',
        description: 'The City of Light, synonymous with haute cuisine, haute couture, romantic promenades, and the Louvre.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e04',
        name: 'Santorini',
        country: 'Greece',
        latitude: 36.3932,
        longitude: 25.4615,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-santorini.jpg',
        description: 'Iconic volcanic island boasting dramatic caldera cliffs, whitewashed cubist villas, and azure Aegean sunsets.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e05',
        name: 'Venice',
        country: 'Italy',
        latitude: 45.4408,
        longitude: 12.3155,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-venice.jpg',
        description: 'The floating queen of the Adriatic, linked by intricate waterways, marble palaces, and historic gondolas.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e06',
        name: 'Tokyo',
        country: 'Japan',
        latitude: 35.6762,
        longitude: 139.6503,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-tokyo.jpg',
        description: 'Futuristic neon skyline blended seamlessly with ancient Shinto shrines, pristine gardens, and culinary mastery.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e07',
        name: 'New York',
        country: 'United States',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-newyork.jpg',
        description: 'The city that never sleeps, home to Broadway, Central Park, towering art deco skyscrapers, and global culture.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e08',
        name: 'Dubai',
        country: 'United Arab Emirates',
        latitude: 25.2048,
        longitude: 55.2708,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-dubai.jpg',
        description: 'A dazzling oasis of record-breaking architecture, luxury desert safaris, and ultra-modern innovation.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e09',
        name: 'Agra',
        country: 'India',
        latitude: 27.1767,
        longitude: 78.0081,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-agra.jpg',
        description: 'Home of the timeless white marble Taj Mahal, majestic Mughal fortifications, and rich artisanal heritage.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e10',
        name: 'Bali',
        country: 'Indonesia',
        latitude: -8.3405,
        longitude: 115.0920,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-bali.jpg',
        description: 'The Island of the Gods, celebrated for emerald rice terraces, sacred sea temples, and serene wellness retreats.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    }
];

const SEED_BOOKINGS: DbBooking[] = [
    {
        id: 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
        booking_ref: 'BK-92841',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        destination_id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01',
        destination_name: 'Rome',
        attraction_name: 'Colosseum & Ancient Forum',
        user_name: 'Alex Johnson',
        user_email: 'alex.traveler@example.com',
        phone_number: '+1 (555) 234-5678',
        travel_date: '2026-11-15',
        guests_count: 2,
        package_type: 'VIP',
        price_per_person: 68.75,
        total_price: 137.50,
        special_request: 'Morning slot requested with English-speaking archaeologist guide.',
        status: 'confirmed',
        image_url: './assets/destination-rome.png',
        created_at: '2026-02-10T14:30:00.000Z',
        updated_at: '2026-02-10T14:30:00.000Z'
    },
    {
        id: 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
        booking_ref: 'BK-58203',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        destination_id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02',
        destination_name: 'London',
        attraction_name: 'Tower of London & Crown Jewels',
        user_name: 'Alex Johnson',
        user_email: 'alex.traveler@example.com',
        phone_number: '+1 (555) 234-5678',
        travel_date: '2026-12-04',
        guests_count: 1,
        package_type: 'standard',
        price_per_person: 42.00,
        total_price: 42.00,
        special_request: 'Wheelchair-friendly ramp access info please.',
        status: 'pending',
        image_url: './assets/destination-london.jpeg',
        created_at: '2026-02-12T09:15:00.000Z',
        updated_at: '2026-02-12T09:15:00.000Z'
    }
];

const SEED_TESTIMONIALS: DbTestimonial[] = [
    {
        id: 'f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        costumer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        destination_id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01',
        destination_name: 'Rome',
        author_name: 'Mike Taylor',
        author_location: 'Lahore, Pakistan',
        role_title: 'Verified Traveler',
        quote: 'Jadoo made our dream vacation to Rome and Santorini an effortless reality. Every detail was executed with perfection!',
        rating: 5.0,
        avatar_url: './assets/testimonials-avatar-1.png',
        trip_tag: 'Italy & Greece Tour',
        created_at: '2026-01-10T10:00:00.000Z',
        updated_at: '2026-01-10T10:00:00.000Z'
    },
    {
        id: 'f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        costumer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        destination_id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02',
        destination_name: 'London',
        author_name: 'Chris Thomas',
        author_location: 'London, UK',
        role_title: 'CEO of Red Button',
        quote: 'Exceptional service and unmatched attention to detail. Organizing high-profile executive retreats across Europe has never been smoother.',
        rating: 5.0,
        avatar_url: './assets/testimonials-avatar-2.png',
        trip_tag: 'European Executive Retreat',
        created_at: '2026-01-12T11:00:00.000Z',
        updated_at: '2026-01-12T11:00:00.000Z'
    },
    {
        id: 'f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03',
        customer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        costumer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        destination_id: 'c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e03',
        destination_name: 'Paris',
        author_name: 'Sophia Martinez',
        author_location: 'Barcelona, Spain',
        role_title: 'Travel Photographer',
        quote: 'The customized itinerary and 24/7 concierge support blew me away. I captured breathtaking sunrises in Tuscany without worrying about logistics.',
        rating: 4.9,
        avatar_url: './assets/testimonials-avatar-3.png',
        trip_tag: 'Swiss & Tuscany Discovery',
        created_at: '2026-01-18T14:20:00.000Z',
        updated_at: '2026-01-18T14:20:00.000Z'
    }
];

// Initialize global in-memory caches with seed defaults
if (typeof window !== 'undefined') {
    (window as any).__jadoo_destinations_cache = (window as any).__jadoo_destinations_cache || SEED_DESTINATIONS;
    (window as any).__jadoo_testimonials_cache = (window as any).__jadoo_testimonials_cache || SEED_TESTIMONIALS;
    (window as any).__jadoo_bookings_cache = (window as any).__jadoo_bookings_cache || [];
}

// ═══════════════════════════════════════════════════════════════
// JadooDatabase  –  public API (compatible with the old engine)
// ═══════════════════════════════════════════════════════════════
class JadooDatabase {

    // ── DESTINATIONS ──────────────────────────────
    async getDestinationsAsync(): Promise<DbDestination[]> {
        try {
            const data = await apiFetch<DbDestination[]>('/api/destinations');
            if (Array.isArray(data) && data.length > 0) {
                (window as any).__jadoo_destinations_cache = data;
                return data;
            }
            return SEED_DESTINATIONS;
        } catch (err) {
            console.error('getDestinationsAsync error:', err);
            return SEED_DESTINATIONS;
        }
    }

    /** Sync shim — returns cached value or seed */
    getDestinations(): DbDestination[] {
        return (window as any).__jadoo_destinations_cache || SEED_DESTINATIONS;
    }

    async getDestinationAsync(nameOrId: string): Promise<DbDestination | undefined> {
        try {
            return await apiFetch<DbDestination>(`/api/destinations/${encodeURIComponent(nameOrId)}`);
        } catch {
            return undefined;
        }
    }

    getDestination(nameOrId: string): DbDestination | undefined {
        const cache: DbDestination[] = (window as any).__jadoo_destinations_cache || [];
        const s = nameOrId.trim().toLowerCase();
        return cache.find(d => d.id === s || d.name.toLowerCase() === s);
    }

    // ── ATTRACTIONS ───────────────────────────────
    async getAttractionsAsync(destination?: string, category?: string): Promise<DbAttraction[]> {
        try {
            const params = new URLSearchParams();
            if (destination) params.set('destination', destination);
            if (category && category !== 'All') params.set('category', category);
            return await apiFetch<DbAttraction[]>(`/api/attractions?${params}`);
        } catch (err) {
            console.error('getAttractionsAsync error:', err);
            return [];
        }
    }

    getAttractions(destination?: string, category?: string): DbAttraction[] {
        let cache: DbAttraction[] = (window as any).__jadoo_attractions_cache || [];
        if (destination) cache = cache.filter(a => a.destination_name.toLowerCase().includes(destination.toLowerCase()));
        if (category && category !== 'All') cache = cache.filter(a => a.category === category);
        return cache;
    }

    // ── BOOKINGS ──────────────────────────────────
    async getBookingsAsync(email?: string, customerId?: string, status?: string): Promise<DbBooking[]> {
        try {
            const params = new URLSearchParams();
            if (email) params.set('email', email);
            if (customerId) params.set('customer_id', customerId);
            if (status) params.set('status', status);
            return await apiFetch<DbBooking[]>(`/api/bookings?${params}`);
        } catch (err) {
            console.error('getBookingsAsync error:', err);
            return [];
        }
    }

    getBookings(): DbBooking[] {
        const cache = (window as any).__jadoo_bookings_cache;
        if (Array.isArray(cache)) return cache;
        try {
            const ls = localStorage.getItem('jadoo_bookings');
            if (ls) {
                const parsed = JSON.parse(ls);
                if (Array.isArray(parsed)) {
                    (window as any).__jadoo_bookings_cache = parsed;
                    return parsed;
                }
            }
        } catch (_) {}
        return [];
    }

    getUserBookings(email?: string, filter?: string): DbBooking[] {
        const currentUser = this.getCurrentUser();
        const e = (email || currentUser?.email || '').trim().toLowerCase();
        const uid = (currentUser?.id || '').trim().toLowerCase();
        if (!e && !uid) return [];
        let list = this.getBookings().filter(b => {
            const bEmail = (b.user_email || (b as any).userEmail || (b as any).email || '').toLowerCase().trim();
            const bCust = String(b.customer_id || (b as any).customerId || (b as any).user_id || '').toLowerCase().trim();
            const matchesEmail = Boolean(e && bEmail === e);
            const matchesId = Boolean(uid && bCust === uid);
            return matchesEmail || matchesId;
        });
        if (filter && filter !== 'all') {
            const f = filter.trim().toLowerCase();
            list = list.filter(b => (b.status || '').toLowerCase() === f);
        }
        return list;
    }

    async getUserBookingsAsync(email?: string, filter?: string): Promise<DbBooking[]> {
        return this.getBookingsAsync(email, undefined, filter);
    }

    async getBookingAsync(idOrRef: string): Promise<DbBooking | undefined> {
        try {
            return await apiFetch<DbBooking>(`/api/bookings/${encodeURIComponent(idOrRef)}`);
        } catch {
            return undefined;
        }
    }

    getBooking(idOrRef: string): DbBooking | undefined {
        const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
        const s = idOrRef.trim().toLowerCase();
        return cache.find(b => 
            (b.id && b.id.toLowerCase() === s) || 
            (b.booking_ref && b.booking_ref.toLowerCase() === s) ||
            ((b as any).bookingRef && (b as any).bookingRef.toLowerCase() === s)
        );
    }

    async addBookingAsync(data: Omit<DbBooking, 'id' | 'created_at' | 'updated_at'>): Promise<DbBooking> {
        const result = await apiFetch<DbBooking>('/api/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        // Sync to legacy localStorage for backwards-compat
        this._syncBookingToLegacy(result);
        return result;
    }

    addBooking(data: Omit<DbBooking, 'id' | 'created_at' | 'updated_at'>): DbBooking {
        const stub: DbBooking = {
            ...data,
            id: generateUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
        cache.unshift(stub);
        (window as any).__jadoo_bookings_cache = cache;

        this.addBookingAsync(data).then(b => {
            stub.id = b.id;
            stub.booking_ref = b.booking_ref;
            this._syncBookingToLegacy(b);
        }).catch(console.error);
        return stub;
    }

    private _syncBookingToLegacy(b: DbBooking): void {
        try {
            const legacyList = JSON.parse(localStorage.getItem('jadoo_bookings') || '[]');
            legacyList.unshift({
                id: b.id,
                bookingRef: b.booking_ref,
                bookingReference: b.booking_ref,
                destination: b.destination_name,
                destinationId: b.destination_id,
                attraction: b.attraction_name,
                userName: b.user_name,
                userEmail: b.user_email,
                phoneNumber: b.phone_number,
                travelDate: b.travel_date,
                guests: b.guests_count,
                packageType: b.package_type,
                pricePerPerson: b.price_per_person,
                totalPrice: b.total_price,
                specialRequests: b.special_request,
                status: b.status === 'confirmed' ? 'Confirmed' : b.status === 'pending' ? 'Pending' : 'Cancelled',
                createdAt: b.created_at,
                image: b.image_url
            });
            localStorage.setItem('jadoo_bookings', JSON.stringify(legacyList));
        } catch { }
    }

    async updateBookingStatusAsync(idOrRef: string, status: DbBookingStatus): Promise<boolean> {
        try {
            await apiFetch(`/api/bookings/${encodeURIComponent(idOrRef)}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            const s = idOrRef.trim().toLowerCase();
            const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
            const found = cache.find(b => b.id?.toLowerCase() === s || b.booking_ref?.toLowerCase() === s);
            if (found) {
                found.status = status;
            }
            try {
                const ls = localStorage.getItem('jadoo_bookings');
                if (ls) {
                    const list = JSON.parse(ls);
                    const item = list.find((b: any) => b.id?.toLowerCase() === s || b.booking_ref?.toLowerCase() === s || (b.bookingReference || '').toLowerCase() === s);
                    if (item) {
                        item.status = status;
                        localStorage.setItem('jadoo_bookings', JSON.stringify(list));
                    }
                }
            } catch (_) {}
            return true;
        } catch {
            return false;
        }
    }

    updateBookingStatus(idOrRef: string, status: DbBookingStatus): boolean {
        const s = idOrRef.trim().toLowerCase();
        const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
        const found = cache.find(b => b.id?.toLowerCase() === s || b.booking_ref?.toLowerCase() === s);
        if (found) {
            found.status = status;
        }
        try {
            const ls = localStorage.getItem('jadoo_bookings');
            if (ls) {
                const list = JSON.parse(ls);
                const item = list.find((b: any) => b.id?.toLowerCase() === s || b.booking_ref?.toLowerCase() === s);
                if (item) {
                    item.status = status;
                    localStorage.setItem('jadoo_bookings', JSON.stringify(list));
                }
            }
        } catch (_) {}
        this.updateBookingStatusAsync(idOrRef, status).catch(console.error);
        return true;
    }

    cancelBooking(idOrRef: string): boolean {
        return this.updateBookingStatus(idOrRef, 'cancelled');
    }

    // ── TESTIMONIALS ──────────────────────────────
    async getTestimonialsAsync(): Promise<DbTestimonial[]> {
        try {
            return await apiFetch<DbTestimonial[]>('/api/testimonials');
        } catch (err) {
            console.error('getTestimonialsAsync error:', err);
            return [];
        }
    }

    getTestimonials(): DbTestimonial[] {
        return (window as any).__jadoo_testimonials_cache || SEED_TESTIMONIALS;
    }

    async addTestimonialAsync(data: Omit<DbTestimonial, 'id' | 'created_at' | 'updated_at'>): Promise<DbTestimonial> {
        return apiFetch<DbTestimonial>('/api/testimonials', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    addTestimonial(data: Omit<DbTestimonial, 'id' | 'created_at' | 'updated_at'>): DbTestimonial {
        const stub: DbTestimonial = {
            ...data,
            id: generateUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const cache: DbTestimonial[] = (window as any).__jadoo_testimonials_cache || [];
        cache.unshift(stub);
        (window as any).__jadoo_testimonials_cache = cache;

        this.addTestimonialAsync(data).then(saved => {
            if (saved && saved.id) {
                stub.id = saved.id;
            }
        }).catch(console.error);
        return stub;
    }

    // ── RELATIONAL HELPERS ────────────────────────
    async getCustomerAsync(idOrEmail: string): Promise<DbCustomer | undefined> {
        try {
            const params = new URLSearchParams();
            if (idOrEmail.includes('@')) params.set('email', idOrEmail);
            else params.set('id', idOrEmail);
            return await apiFetch<DbCustomer>(`/api/auth/profile?${params}`);
        } catch {
            return undefined;
        }
    }

    getCustomer(idOrEmail: string): DbCustomer | undefined {
        return undefined; // Use async variant
    }

    async getBookingsByCustomerAsync(customerId: string): Promise<DbBooking[]> {
        return this.getBookingsAsync(undefined, customerId);
    }

    getBookingsByCustomer(customerId: string): DbBooking[] {
        const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
        return cache.filter(b => b.customer_id === customerId);
    }

    // ── SERVICES ──────────────────────────────────
    async getServicesAsync(category?: string): Promise<DbTravelService[]> {
        try {
            const url = category && category.toLowerCase() !== 'all'
                ? `/api/services?category=${encodeURIComponent(category)}`
                : '/api/services';
            return await apiFetch<DbTravelService[]>(url);
        } catch {
            return [];
        }
    }

    async getServiceBySlugAsync(slug: string): Promise<DbTravelService | undefined> {
        try {
            return await apiFetch<DbTravelService>(`/api/services/${encodeURIComponent(slug)}`);
        } catch {
            return undefined;
        }
    }

    async submitServiceInquiryAsync(data: DbServiceInquiry): Promise<DbServiceInquiry> {
        return apiFetch<DbServiceInquiry>('/api/services/inquire', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async createServiceAsync(data: Partial<DbTravelService>): Promise<DbTravelService> {
        return apiFetch<DbTravelService>('/api/services', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getBookingsByDestinationAsync(destinationId: string): Promise<DbBooking[]> {
        return this.getBookingsAsync(undefined, undefined, undefined);
    }

    getBookingsByDestination(destinationId: string): DbBooking[] {
        const cache: DbBooking[] = (window as any).__jadoo_bookings_cache || [];
        return cache.filter(b => b.destination_id === destinationId);
    }

    async getTestimonialsByDestinationAsync(destinationId: string): Promise<DbTestimonial[]> {
        const all = await this.getTestimonialsAsync();
        return all.filter(t => t.destination_id === destinationId);
    }

    getTestimonialsByDestination(destinationId: string): DbTestimonial[] {
        const cache: DbTestimonial[] = (window as any).__jadoo_testimonials_cache || [];
        return cache.filter(t => t.destination_id === destinationId);
    }

    // ── AUTH / SESSION ────────────────────────────

    getCurrentUser(): DbUser | null {
        try {
            if (localStorage.getItem('jadoo_logged_out') === 'true') return null;

            let raw: string | null = localStorage.getItem('jadoo_current_user');

            // Fallback: cookies
            if (!raw && typeof document !== 'undefined') {
                const match = document.cookie.match(/(?:^|; )jadoo_current_user=([^;]*)/);
                if (match) {
                    try { raw = decodeURIComponent(match[1]); } catch { raw = match[1]; }
                }
            }

            if (raw) {
                let legacy: any;
                try { legacy = JSON.parse(raw); } catch { legacy = null; }
                if (legacy && (legacy.fullName || legacy.full_name || legacy.email || legacy.id)) {
                    const full_name = legacy.fullName || legacy.full_name || 'Traveler';
                    const avatar = normalizeAvatar(legacy.avatar_url || legacy.avatarUrl);
                    return {
                        id: legacy.id || generateUUID(),
                        full_name,
                        email: legacy.email || '',
                        phone: legacy.phone || '',
                        avatar_url: avatar,
                        created_at: legacy.createdAt || legacy.created_at || new Date().toISOString(),
                        logged_in_at: legacy.loggedInAt || legacy.logged_in_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            }
        } catch { }
        return null;
    }

    setCurrentUser(user: { id?: string; full_name?: string; fullName?: string; email: string; phone?: string; avatar_url?: string; token?: string }): DbUser {
        localStorage.removeItem('jadoo_logged_out');
        const full_name = user.full_name || user.fullName || 'Traveler';
        const avatar = normalizeAvatar(user.avatar_url);
        const dbUser: DbUser = {
            id: user.id || generateUUID(),
            full_name,
            email: user.email,
            phone: user.phone || '',
            avatar_url: avatar,
            token: user.token,
            created_at: new Date().toISOString(),
            logged_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (user.token) {
            try {
                localStorage.setItem('jadoo_auth_token', user.token);
                document.cookie = `jadoo_auth_token=${encodeURIComponent(user.token)}; path=/; max-age=604800; SameSite=Lax`;
            } catch (_) {}
        }
        const payload = JSON.stringify({
            id: dbUser.id,
            fullName: dbUser.full_name,
            full_name: dbUser.full_name,
            email: dbUser.email,
            phone: dbUser.phone,
            avatar_url: dbUser.avatar_url,
            createdAt: dbUser.created_at,
            loggedInAt: dbUser.logged_in_at,
            token: dbUser.token
        });
        localStorage.setItem('jadoo_current_user', payload);
        document.cookie = `jadoo_current_user=${encodeURIComponent(payload)}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_current_user' } }));
        return dbUser;
    }

    logout(): void {
        try {
            // Backend session cleanup
            const primaryBase = getApiBase();
            fetch(`${primaryBase}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});

            const current = this.getCurrentUser();
            if (current) {
                localStorage.setItem('jadoo_last_account', JSON.stringify({
                    id: current.id,
                    email: current.email,
                    fullName: current.full_name
                }));
            }
            localStorage.setItem('jadoo_logged_out', 'true');
            localStorage.setItem('jadoo_sync_event', Date.now().toString());
            localStorage.removeItem('jadoo_current_user');
            localStorage.removeItem('jadoo_auth_token');
            document.cookie = 'jadoo_current_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            document.cookie = 'jadoo_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: false } }));
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_current_user', type: 'logout' } }));
        } catch { }
    }

    async updateProfileAsync(updated: Partial<DbUser>): Promise<DbUser | null> {
        const current = this.getCurrentUser();
        if (!current) return null;
        try {
            const result = await apiFetch<DbUser>('/api/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify({ id: current.id, email: current.email, ...updated })
            });
            // Also update local session
            this.setCurrentUser(result);
            return result;
        } catch (err) {
            console.error('updateProfileAsync error:', err);
            // Fallback: update local session only
            const merged: DbUser = { ...current, ...updated, updated_at: new Date().toISOString() };
            this.setCurrentUser(merged);
            return merged;
        }
    }

    updateProfile(updated: Partial<DbUser>): DbUser | null {
        const current = this.getCurrentUser();
        if (!current) return null;
        const merged: DbUser = { ...current, ...updated, updated_at: new Date().toISOString() };
        this.setCurrentUser(merged);
        this.updateProfileAsync(updated).catch(console.error);
        return merged;
    }

    // Auth: register
    async registerAsync(data: { full_name: string; email: string; password?: string; phone?: string; avatar_url?: string }): Promise<DbUser> {
        const result = await apiFetch<DbUser>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        this.setCurrentUser(result);
        return result;
    }

    // Auth: login
    async loginAsync(email: string, password?: string): Promise<DbUser> {
        const result = await apiFetch<DbUser>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setCurrentUser(result);
        return result;
    }

    /** @deprecated use getUsers() only for legacy compatibility */
    getUsers(): DbUser[] {
        const current = this.getCurrentUser();
        return current ? [current] : [];
    }

    // ── CACHE PRIMING (call once on page load) ────
    async primeCache(): Promise<void> {
        try {
            const [destinations, testimonials, attractions] = await Promise.all([
                this.getDestinationsAsync(),
                this.getTestimonialsAsync(),
                this.getAttractionsAsync()
            ]);
            (window as any).__jadoo_destinations_cache = destinations;
            (window as any).__jadoo_testimonials_cache = testimonials;
            (window as any).__jadoo_attractions_cache = attractions;

            const user = this.getCurrentUser();
            if (user?.email || user?.id) {
                const bookings = await this.getBookingsAsync(user?.email || undefined, user?.id || undefined);
                if (Array.isArray(bookings) && bookings.length > 0) {
                    (window as any).__jadoo_bookings_cache = bookings;
                    try {
                        localStorage.setItem('jadoo_bookings', JSON.stringify(bookings));
                    } catch (_) {}
                } else {
                    const existing = this.getBookings();
                    if (existing && existing.length > 0) {
                        (window as any).__jadoo_bookings_cache = existing;
                    } else if (Array.isArray(bookings)) {
                        (window as any).__jadoo_bookings_cache = bookings;
                    }
                }
            } else {
                (window as any).__jadoo_bookings_cache = [];
            }
        } catch (err) {
            console.warn('Cache priming failed (server may not be running):', err);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════
export const JadooDB = new JadooDatabase();

declare global {
    interface Window {
        JadooDB?: JadooDatabase;
    }
}

if (typeof window !== 'undefined') {
    window.JadooDB = JadooDB;
    // Auto-prime cache when page loads
    window.addEventListener('DOMContentLoaded', () => {
        JadooDB.primeCache().catch(() => {});
    });
}
